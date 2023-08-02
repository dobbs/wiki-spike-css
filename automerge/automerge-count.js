import * as Automerge from '@automerge/automerge'

export function automergeCount(element) {
  let doc1 = Automerge.init()
  doc1 = Automerge.change(doc1, 'initialize count', doc => {
    doc.count = 0
  })
  const setCount = (count) => {
    doc1 = Automerge.change(doc1, 'set count', doc => {
      doc.count = count
    })
    element.innerHTML = `count is ${doc1.count}`
  }
  element.onclick = () => setCount(doc1.count + 1)
  element.history = () => Automerge.getHistory(doc1)
  element.doc = () => doc1
  setCount(0)
}
