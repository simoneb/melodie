'use strict'

const { join } = require('path')
const faker = require('faker')
const electron = require('electron')
const osLocale = require('os-locale')
const settingsService = require('./settings')
const { local, audiodb, discogs } = require('../providers')
const { settingsModel } = require('../models/settings')
const { broadcast } = require('../utils')

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
jest.mock('../providers/discogs')
jest.mock('../providers/audiodb')
jest.mock('../utils/electron-remote')

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
    const saved = { folders, locale, openCount }
    settingsModel.save.mockResolvedValueOnce(saved)

    expect(await settingsService.setLocale(locale)).toEqual(saved)
    expect(settingsModel.save).toHaveBeenCalledWith(saved)
  })

  it('saves AudioDB provider key', async () => {
    const locale = faker.random.word()
    const key = faker.random.uuid()
    const providers = {
      audiodb: { foo: faker.random.word() },
      discogs: { foo: faker.random.word() }
    }
    settingsModel.get.mockResolvedValueOnce({ locale, providers })
    const saved = { locale, providers: { ...providers, audiodb: { key } } }
    settingsModel.save.mockResolvedValueOnce(saved)

    expect(await settingsService.setAudioDBKey(key)).toEqual(saved)
    expect(settingsModel.save).toHaveBeenCalledWith(saved)
    expect(settingsModel.save).toHaveBeenCalledTimes(1)
    expect(audiodb.init).toHaveBeenCalledWith({ key })
    expect(audiodb.init).toHaveBeenCalledTimes(1)
    expect(discogs.init).not.toHaveBeenCalled()
  })

  it('saves Discogs provider token', async () => {
    const locale = faker.random.word()
    const token = faker.random.uuid()
    const providers = {
      audiodb: { foo: faker.random.word() },
      discogs: { foo: faker.random.word() }
    }
    settingsModel.get.mockResolvedValueOnce({ locale, providers })
    const saved = { locale, providers: { ...providers, discogs: { token } } }
    settingsModel.save.mockResolvedValueOnce(saved)

    expect(await settingsService.setDiscogsToken(token)).toEqual(saved)
    expect(settingsModel.save).toHaveBeenCalledWith(saved)
    expect(settingsModel.save).toHaveBeenCalledTimes(1)
    expect(discogs.init).toHaveBeenCalledWith({ token })
    expect(discogs.init).toHaveBeenCalledTimes(1)
    expect(audiodb.init).not.toHaveBeenCalled()
  })

  it('saves enqueue behaviour', async () => {
    const locale = faker.random.word()
    const onClick = faker.random.boolean()
    const clearBefore = faker.random.boolean()
    const providers = {
      audiodb: { foo: faker.random.word() },
      discogs: { foo: faker.random.word() }
    }
    settingsModel.get.mockResolvedValueOnce({
      locale,
      providers,
      enqueueBehaviour: { clearBefore, onClick }
    })
    const newValues = {
      onClick: !onClick,
      clearBefore: !clearBefore
    }
    const saved = { locale, providers, enqueueBehaviour: newValues }
    settingsModel.save.mockResolvedValueOnce(saved)

    expect(await settingsService.setEnqueueBehaviour(newValues)).toEqual(saved)
    expect(settingsModel.save).toHaveBeenCalledWith(saved)
    expect(settingsModel.save).toHaveBeenCalledTimes(1)
  })

  describe('init', () => {
    const providers = {
      audiodb: { foo: faker.random.word() },
      discogs: { foo: faker.random.word() }
    }
    const locale = faker.random.word()

    it('increments opening count', async () => {
      const openCount = faker.random.number({ min: 1 })
      settingsModel.get.mockResolvedValueOnce({ openCount, locale, providers })

      await settingsService.init()
      expect(settingsModel.save).toHaveBeenCalledWith({
        openCount: openCount + 1,
        locale,
        providers
      })
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
    })

    it('initialize providers', async () => {
      settingsModel.get.mockResolvedValueOnce({
        openCount: 0,
        locale,
        providers
      })

      await settingsService.init()
      expect(discogs.init).toHaveBeenCalledWith(providers.discogs)
      expect(discogs.init).toHaveBeenCalledTimes(1)
      expect(audiodb.init).toHaveBeenCalledWith(providers.audiodb)
      expect(audiodb.init).toHaveBeenCalledTimes(1)
    })

    it('triggers comparison providers', async () => {
      settingsModel.get.mockResolvedValueOnce({
        openCount: 0,
        locale,
        providers
      })

      await settingsService.init()

      expect(local.compareTracks).toHaveBeenCalledTimes(1)
      expect(audiodb.compareTracks).toHaveBeenCalledTimes(1)
      expect(discogs.compareTracks).toHaveBeenCalledTimes(1)
    })
  })

  describe('addFolders', () => {
    it('saves selected folders to settings', async () => {
      const locale = faker.random.word()
      const folders = [faker.system.fileName()]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })
      const filePaths = [faker.system.fileName(), faker.system.fileName()]
      electron.dialog.showOpenDialog.mockResolvedValueOnce({ filePaths })
      const finalFolders = folders.concat(filePaths)
      const saved = { id: settingsModel.ID, folders: finalFolders, locale }
      settingsModel.save.mockResolvedValueOnce(saved)
      local.importTracks.mockResolvedValueOnce()

      expect(await settingsService.addFolders()).toEqual(saved)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith(saved)
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(local.importTracks).toHaveBeenCalledTimes(1)
      expect(electron.dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory', 'multiSelections']
      })
      expect(broadcast).toHaveBeenCalledWith('watching-folders', filePaths)
      expect(broadcast).toHaveBeenCalledTimes(1)
    })

    it('does not saves empty selection', async () => {
      electron.dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [] })

      expect(await settingsService.addFolders()).toEqual(null)

      expect(settingsModel.get).not.toHaveBeenCalled()
      expect(settingsModel.save).not.toHaveBeenCalled()
      expect(local.importTracks).not.toHaveBeenCalled()
      expect(broadcast).not.toHaveBeenCalled()
    })

    it('saves specified folders to settings and invoke done callback', async () => {
      const locale = faker.random.word()
      const folders = [faker.system.fileName()]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })
      const added = [faker.system.fileName(), faker.system.fileName()]
      const finalFolders = folders.concat(added)
      const saved = { id: settingsModel.ID, folders: finalFolders, locale }
      settingsModel.save.mockResolvedValueOnce(saved)
      local.importTracks.mockResolvedValueOnce()

      const onDone = jest.fn()

      expect(await settingsService.addFolders(added, onDone)).toEqual(saved)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith(saved)
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(local.importTracks).toHaveBeenCalledTimes(1)
      expect(electron.dialog.showOpenDialog).not.toHaveBeenCalled()
      expect(onDone).toHaveBeenCalledAfter(broadcast)
      expect(broadcast).toHaveBeenCalledWith('watching-folders', added)
      expect(broadcast).toHaveBeenCalledTimes(1)
    })

    it('merges nested added folders into its tracked parent', async () => {
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
      const saved = { id: settingsModel.ID, folders: finalFolders, locale }
      settingsModel.save.mockResolvedValueOnce(saved)
      local.importTracks.mockResolvedValueOnce()

      expect(await settingsService.addFolders()).toEqual(saved)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith(saved)
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(local.importTracks).toHaveBeenCalledTimes(1)
      expect(broadcast).toHaveBeenCalledWith(
        'watching-folders',
        filePaths.slice(2)
      )
      expect(broadcast).toHaveBeenCalledTimes(1)
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
      const saved = { id: settingsModel.ID, folders: finalFolders, locale }
      settingsModel.save.mockResolvedValueOnce(saved)
      local.importTracks.mockResolvedValueOnce()

      expect(await settingsService.addFolders()).toEqual(saved)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith(saved)
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(local.importTracks).toHaveBeenCalledTimes(1)
      expect(broadcast).toHaveBeenCalledWith('watching-folders', [parent])
      expect(broadcast).toHaveBeenCalledTimes(1)
    })

    it('does not import already-watched folders', async () => {
      const locale = faker.random.word()
      const parent1 = join(faker.lorem.word(), faker.lorem.word())
      const parent2 = join(faker.lorem.word(), faker.lorem.word())
      const folders = [parent1, parent2]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })
      electron.dialog.showOpenDialog.mockResolvedValueOnce({
        filePaths: [
          join(parent1, faker.lorem.word()),
          join(parent2, faker.lorem.word())
        ]
      })

      expect(await settingsService.addFolders()).toEqual({ folders, locale })

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).not.toHaveBeenCalled()
      expect(local.importTracks).not.toHaveBeenCalled()
      expect(broadcast).not.toHaveBeenCalled()
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
      const saved = {
        id: settingsModel.ID,
        folders: [folders[0], folders[2]],
        locale
      }
      settingsModel.save.mockResolvedValueOnce(saved)

      expect(await settingsService.removeFolder(folders[1])).toEqual(saved)

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).toHaveBeenCalledWith(saved)
      expect(settingsModel.save).toHaveBeenCalledTimes(1)
      expect(local.importTracks).toHaveBeenCalledTimes(1)
    })

    it('ignores untracked folder', async () => {
      const locale = faker.random.word()
      const folders = [faker.system.fileName(), faker.system.fileName()]
      settingsModel.get.mockResolvedValueOnce({ folders, locale })

      expect(
        await settingsService.removeFolder(faker.system.fileName())
      ).toEqual({ folders, locale })

      expect(settingsModel.get).toHaveBeenCalledTimes(1)
      expect(settingsModel.save).not.toHaveBeenCalled()
      expect(local.importTracks).not.toHaveBeenCalled()
    })
  })
})
