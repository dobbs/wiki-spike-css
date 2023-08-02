import {
  automergeInit, automergeCount, automergeSave, automergeLoad
} from './automerge-count.js'

document.querySelector('#app').innerHTML = `
  <h1>Hello, World!</h1>
  <button id="count" type="button"></button>
  <button id="save" type="button">save</button>
  <button id="reset" type="button">reset</button>
`

await automergeInit(document.querySelector('#count'))
automergeCount(document.querySelector('#count'))
automergeLoad(document.querySelector('#reset'))
automergeSave(document.querySelector('#save'))
