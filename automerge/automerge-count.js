import * as Automerge from '@automerge/automerge'
import * as localforage from 'localforage'

let doc1
let db
let it

export async function automergeInit(element) {
  it = element
  localforage.setDriver(localforage.INDEXEDDB)
  db = localforage.createInstance({name:'automerge-count'})
  await load()
}
function setCount(count) {
  doc1 = Automerge.change(doc1, 'set count', doc => {
    doc.count = count
  })
}
function render() {
  it.innerHTML = `count is ${doc1.count}`
}
async function save() {
  try {
    let serialized = Automerge.save(doc1)
    await db.setItem('doc1', serialized)
  } catch (err) {
    console.error('unable to save db', err)
  }
}
async function load() {
  try {
    let serialized = await db.getItem('doc1')
    if (serialized) {
      doc1 = Automerge.load(serialized)
    } else {
      doc1 = Automerge.init()
      doc1 = Automerge.change(doc1, 'initialize count', doc => {
        doc.count = 0
      })
    }
    render()
  } catch (err) {
    console.error('unable to load db', err)
  }
}

export function automergeCount(element) {
  element.onclick = () => {
    setCount(doc1.count + 1)
    render()
  }
}

export function automergeLoad(element) {
  element.onclick = load
}

export function automergeSave(element) {
  element.onclick = save
}
