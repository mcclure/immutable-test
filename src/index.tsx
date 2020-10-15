import { h, render, Component } from "preact";
import linkState from 'linkstate';
import { State, WrapStateContexts } from "./state"
import { SortedList } from "immutable"

declare let require:any

// ----- Data helpers -----

// Convert to number if this is a string describing a number, otherwise do nothing
// Nightmare function adapted from https://stackoverflow.com/a/35759874/6582253
function numericOrUnchanged<T>(str:T) : number|T {
  if (typeof str != "string") return str
  const parsedAsNumber = parseFloat(str)
  const isNumber = !isNaN(str as any) && !isNaN(parsedAsNumber)
  return isNumber ? parsedAsNumber : str
}

function typedFormat(v:any) {
  let type = typeof v
  if (type == "string")
    return <div className="DataString">{`"${v}"`}</div>
  if (type == "number")
    return <div className="DataNumber">{String(v)}</div>
  if (type == "boolean" || type == "undefined" || v == "null")
    return <div className="DataSpecial">{String(v)}</div>
  return <div className="DataOther">{String(v)}</div>
}

// ----- Data -----

const data = new State(SortedList<number|string>())

// ----- Display helpers -----

// Note the convention in this page:
// - Functional components are used for anything that uses context
// - Class components are used for anything that uses linkState
// This convention does prevent context and linkState from being used together.
// But maybe that's a good thing.

// Modal "pick a username" box
type ListEditState = {entry:string}
type ListEditProps = {targetState:State<SortedList<number|string>>}
class ListEdit extends Component<ListEditProps, ListEditState> {
  constructor(props:ListEditProps) {
    super(props)
    this.state = {entry:''}
  }
  handlePush() {
    const targetState = this.props.targetState
    const entry = numericOrUnchanged(this.state.entry)
    if (entry != null) { // Intentionally catches undefined also
      console.log(`Pushing: ${String(entry)}`)
      targetState.set(targetState.value.add(entry))
      this.setState({entry:''})
    }
  }
  handleShift() {
    const targetState = this.props.targetState
    console.log(`Shifting: ${String(targetState.value.first())}`)
    targetState.set(targetState.value.shift())
  }
  handlePop() {
    const targetState = this.props.targetState
    console.log(`Popping: ${String(targetState.value.last())}`)
    targetState.set(targetState.value.pop())
  }
  render() {
    return (
      <div className="EditBox">
        <form onSubmit={(e)=>{e.preventDefault(); this.handlePush(); return true}}>
          <label>
            <input type="text" value={this.state.entry} onInput={linkState(this, 'entry')} />
          </label>
          <input type="submit" disabled={!Boolean(this.state.entry)} value="Add" />
          <input type="button" onClick={(e) => {this.handleShift(); return true}} value="Shift" />
          <input type="button" onClick={(e) => {this.handlePop(); return true}} value="Pop" />
        </form>
      </div>
    )
  }
}

// None of the VNode stuff is exported, so this has to all be untyped.
// This is violating abstraction boundaries in order to debug internal structures.
function nodeToDiv(list:any, node:any) {
  if (node && typeof node == "object" && node["@@__IMMUTABLE_SORTED_LIST_NODE__@@"]) {
    const isHead = list._head == node
    const isTail = list._tail == node

    let id:string = undefined
    if (isHead && isTail) id = "headTail"
    else if (isHead) id = "head"
    else if (isTail) id = "tail"

    let headMarker = null
    if (isHead) headMarker = <div className="NodeMetaHead">(Head)</div>
    let tailMarker = null
    if (isTail) tailMarker = <div className="NodeMetaTail">(Tail)</div>

    let children = node.array.map((child:any) => nodeToDiv(list, child))

    return <div className="NodeDisplay" id={id}>
      <div className="NodeMeta">
        <div className="NodeMetaMin">
          Min: {typedFormat(node.min)}
        </div>
        <div className="NodeMetaMax">
          Max: {typedFormat(node.max)}
        </div>
        {headMarker}
        {tailMarker}
      </div>
      <div className="NodeContent">
        {children}
      </div>
    </div>
  } else {
    return <div className="NodeData">
      {typedFormat(node)}
    </div>
  }
}

function ListDisplay<T>({targetState}:{targetState:State<SortedList<T>>}) {
  const list = targetState.get()
  console.log(list)
  return <div className="ListDisplay">
    <div className="ListMeta">
      <div className="ListMetaItem">Size: <div className="DataNumber">{(list as any).size}</div></div>
      <div className="ListMetaItem">Depth: <div className="DataNumber">{(list as any)._level}</div></div>
    </div>
    <div className="ListContent">
      {nodeToDiv(list, (list as any)._root)}
    </div>
  </div>
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

function Content() {
  return (
    <div className="Content">
      <ListEdit targetState={data} />
      <ListDisplay targetState={data} />
    </div>)
}

render(
  WrapStateContexts(<Content />, [data]),
  parentNode, replaceNode
)
