'use strict'

const EventEmitter = require('events')
import '../common'

export const mockInvoke = jest.fn()
export const mockIpcRenderer = new EventEmitter()
mockIpcRenderer.invoke = mockInvoke

// jsdom does not support loading and playback operations
window.HTMLMediaElement.prototype.load = jest.fn()
window.HTMLMediaElement.prototype.play = jest.fn()
window.HTMLMediaElement.prototype.pause = jest.fn()

jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer
}))