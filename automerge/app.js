import { automergeCount } from './automerge-count.js'

document.querySelector('#app').innerHTML = `
  <h1>Hello, World!</h1>
  <button id="count" type="button"></button>
`

automergeCount(document.querySelector('#count'))
