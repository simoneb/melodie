'use strict'

const { join } = require('path')
const faker = require('faker')
const electron = require('electron')
const osLocale = require('os-locale')
const settingsService = require('./settings')
const provider = require('../providers/local')
const { settingsModel } = require('../models/settings')

jest.mock('os-locale')
jest.mock('electron', () => ({
  dialog: {
    showOpenDialog: jest.fn()
  },
  app: {
    getPath: jest.fn().mockReturnValue('')
  }
}))
jest.mock('../services')
jest.mock('../models/settings')
jest.mock('../providers/local')

describe('Settings service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    settingsModel.get.mockResolvedValue({})
  })

  it('returns settings', async () => {
    const folders = [faker.system.fileName(), faker.system.fileName()]
    const locale = faker.random.word()
    const openCount = faker.random.number({ min: 1 })
    settingsModel.get.mockResolvedValueOnce({ folders, locale, openCount })
    osLocale.mockResolvedValueOnce('fr-FR')

    expect(await settingsService.get()).toEqual({ folders, locale, openCount })
    expect(osLocale).not.toHaveBeenCalled()
  })

  it('returns system locale when locale not set', async () => {
    const folders = [faker.system.fileName(), faker.system.fileName()]
    const openCount = faker.random.number({ min: 1 })
    settingsModel.get.mockResolvedValueOnce({ openCount, folders })
    osLocale.mockResolvedValueOnce('fr-FR')

    expect(await settingsService.get()).toEqual({
      locale: 'fr',
      openCount,
      folders
    })
    expect(osLocale).toHaveBeenCalled()
  })

  it('can set locale', async () => {
    const locale = faker.random.word()
    const openCount = faker.random.number({ min: 1 })
    const folders = [faker.system.fileName(), faker.system.fileName()]
    settingsModel.get.mockResolvedValueOnce({ folders, openCount })

    await settingsService.setLocale(locale)

    expect(settingsModel.save).toHaveBeenCalledWith({
      folders,
      locale,
      openCount
    })
  })

  it('increments opening count', async () => {
    const locale = faker.random.word()
    const openCount = faker.random.number({ min: 1 })
    settingsModel.get.mockResolvedValueOnce({ openCount, locale })

    await settingsService.recordOpening()
    expect(settingsModel.save).toHaveBeenCalledWith({
      openCount: openCount + 1,
      locale
    })
    expect(settingsModel.save).toHaveBeenCalledTimes(1)
  })

  describe('addFolders', () => {
    it('saves selected folders to settings', async () => {
      const locale = faker.random.word()
      const folders = [faker.system.fileName()]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })
      const filePaths = [faker.system.fileName(), faker.system.fileName()]
      electron.dialog.showOpenDialog.mockResolvedValueOnce({ filePaths })
      const finalFolders = folders.concat(filePaths)

      expect(await settingsService.addFolders()).toEqual(finalFolders)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith({
        id: settingsModel.ID,
        folders: finalFolders,
        locale
      })
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(provider.importTracks).toHaveBeenCalledTimes(1)
      expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory', 'multiSelections']
      })
    })

    it('does not saves empty selection', async () => {
      electron.dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [] })

      expect(await settingsService.addFolders()).toEqual(null)

      expect(settingsModel.get).not.toHaveBeenCalled()
      expect(settingsModel.save).not.toHaveBeenCalled()
      expect(provider.importTracks).not.toHaveBeenCalled()
    })

    it('merges nested added folder into its tracked parent', async () => {
      const locale = faker.random.word()
      const parent1 = join(faker.lorem.word(), faker.lorem.word())
      const parent2 = join(faker.lorem.word(), faker.lorem.word())
      const folders = [parent1, faker.system.fileName(), parent2]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })
      const filePaths = [
        join(parent1, faker.system.fileName()),
        join(parent2, faker.system.fileName()),
        faker.system.fileName()
      ]
      electron.dialog.showOpenDialog.mockResolvedValueOnce({ filePaths })
      const finalFolders = folders.concat(filePaths.slice(2))

      expect(await settingsService.addFolders()).toEqual(finalFolders)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith({
        id: settingsModel.ID,
        folders: finalFolders,
        locale
      })
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(provider.importTracks).toHaveBeenCalledTimes(1)
    })

    it('removes nested folders when adding a common parent', async () => {
      const locale = faker.random.word()
      const parent = join(faker.lorem.word(), faker.lorem.word())
      const folders = [
        join(parent, faker.system.fileName()),
        faker.system.fileName(),
        join(parent, faker.system.fileName())
      ]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })
      electron.dialog.showOpenDialog.mockResolvedValueOnce({
        filePaths: [parent]
      })
      const finalFolders = [folders[1], parent]

      expect(await settingsService.addFolders()).toEqual(finalFolders)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith({
        id: settingsModel.ID,
        folders: finalFolders,
        locale
      })
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(provider.importTracks).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeFolder', () => {
    it('removes tracked folder from settings', async () => {
      const locale = faker.random.word()
      const folders = [
        faker.system.fileName(),
        faker.system.fileName(),
        faker.system.fileName()
      ]
      settingsModel.get.mockResolvedValueOnce({ folders: [...folders], locale })

      expect(await settingsService.removeFolder(folders[1]))

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith({
        id: settingsModel.ID,
        folders: [folders[0], folders[2]],
        locale
      })
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(provider.importTracks).toHaveBeenCalledTimes(1)
    })

    it('ignores untracked folder', async () => {
      const locale = faker.random.word()
      const folders = [faker.system.fileName(), faker.system.fileName()]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })

      expect(await settingsService.removeFolder(faker.system.fileName()))

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).not.toHaveBeenCalled()
      expect(provider.importTracks).not.toHaveBeenCalled()
    })
  })
})