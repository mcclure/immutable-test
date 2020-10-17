import { h, render, Component, JSX } from "preact";
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

function handle(f:()=>void) {
  return (e:JSX.TargetedEvent) => {
    e.preventDefault();
    f();
    return true;
  }
}

// ----- Data -----

type dataListType = SortedList<number|string>
type dataStateType = State<dataListType>

const HISTORYMAX = 20
const data : dataStateType = new State(SortedList<number|string>())
const optionWhitebox = new State(true);
const history:dataListType[] = []

// ----- Data processes -----

function newData(state:dataStateType, history:dataListType[], value:dataListType) {
  history.push(value)
  if (history.length > HISTORYMAX)
    history.shift()
  state.set(value)
  //console.log(value)
}

function findFirstFailure<T>(list:SortedList<T>) {
  let haveLast = false
  let last
  let count = 0
  for(let x of list) {
    if (haveLast) {
      if (last > x)
        return [count, x]
    } else {
      haveLast = true
    }
    last = x
    count++
  }
  return null
}

function findMinmaxFailureNode<T>(node:any, depth:number, depthMax:number) : [number, string, any] { // Breaks abstraction boundaries so uses any
  const {array, min, max} = node
  if (depth < depthMax-1) { // Branch
    if (min != array[0].min)
      return [depth, "min", min]
    if (max != array[array.length-1].max)
      return [depth, "max", max]

    for (let newNode of array) {
      const test = findMinmaxFailureNode(newNode, depth+1, depthMax)
      if (test)
        return test
    }
  } else { // Leaf
    if (min != array[0])
      return [depth, "min", min]
    if (max != array[array.length-1])
      return [depth, "max", max]
  }
  return null
}
function findMinmaxFailure<T>(list:SortedList<T>) {
  if (list.size > 0)
    return findMinmaxFailureNode((list as any)._root, 0, (list as any)._level)
  return null
}

function findHeadFailure<T>(list:SortedList<T>) {
  let node = (list as any)._root;
  for(let level = 0; level < (list as any)._level-1; level++)
    node = node.array[0]
  return node != (list as any)._head;
}

function findTailFailure<T>(list:SortedList<T>) {
  let node = (list as any)._root;
  for(let level = 0; level < (list as any)._level-1; level++)
    node = node.array[node.array.length-1]
  return node != (list as any)._tail;
}

// Repeat this many times to test the structure
function randomSequence<T>(targetState:dataStateType, targetHistory:dataListType[], count:number, pctAdd : number) {
  const add = Math.random() < pctAdd
  const value = targetState.value

  // Make a random change to the list
  if (add || value.size == 0) {
    const addValue = Math.round(Math.random()*10000)
    console.log(`Random sequence ${count}, add ${ addValue }`)
    newData(targetState, targetHistory, value.add(addValue) )
  } else {
    const side = Math.random() < 0.5
    console.log(`Random sequence ${count}, pop ${ side ? value.first() : value.last() }`)
    newData(targetState, targetHistory, side ? value.shift() : value.pop() )
  }

  // Ensure list items in order
  {
    const failure = findFirstFailure(targetState.value)
    if (failure) {
      const [index, value] = failure
      throw new Error(`Ordering failure at index ${index}, value ${value}`)
    }
  }
  // Ensure internal min/max tracking is correct
  {
    const failure = findMinmaxFailure(targetState.value)
    if (failure) {
      const [depth, kind, value] = failure
      throw new Error(`Min/max failure: wrong ${kind} at depth ${depth}, value ${value}`)
    }
  }
  // Ensure head/tail tracking is correct
  if (findHeadFailure(targetState.value))
    throw new Error("Head failure")
  if (findTailFailure(targetState.value))
    throw new Error("Tail failure")

  if (count > 1)
    requestAnimationFrame(() => { randomSequence(targetState, targetHistory, count-1, pctAdd) })
}

// ----- Display helpers -----

// Note the convention in this page:
// - Functional components are used for anything that uses context
// - Class components are used for anything that uses linkState
// This convention does prevent context and linkState from being used together.
// But maybe that's a good thing.

// Modal "pick a username" box
type ListEditState = {entry:string,whitebox:boolean,historyIndex:number,historyLength:number}
type ListEditProps = {targetState:dataStateType, targetHistory:dataListType[]}
class ListEdit extends Component<ListEditProps, ListEditState> {
  constructor(props:ListEditProps) {
    super(props)
    this.state = {
      entry:'', whitebox:optionWhitebox.value,
      historyIndex:0, historyLength:this.props.targetHistory.length
    }
  }
  historyTruncate() {
    const {targetHistory} = this.props
    const {historyIndex} = this.state
    if (historyIndex > 0)
      targetHistory.length -= historyIndex
  }
  newData(value:dataListType) { // Set data while managing history stack
    const {targetState, targetHistory} = this.props
    this.historyTruncate()
    newData(targetState, targetHistory, value)
    this.setState({entry:'',historyIndex:0,historyLength:targetHistory.length})
  }
  handlePush() {
    const {targetState} = this.props
    const entry = numericOrUnchanged(this.state.entry)
    if (entry != null) { // Intentionally catches undefined also
      console.log(`Pushing: ${String(entry)}`)
      this.newData(targetState.value.add(entry))
      this.setState({entry:''})
      console.log(targetState.value)
    }
  }
  handleShift() {
    const {targetState} = this.props
    console.log(`Shifting: ${String(targetState.value.first())}`)
    this.newData(targetState.value.shift())
  }
  handlePop() {
    const {targetState} = this.props
    console.log(`Popping: ${String(targetState.value.last())}`)
    this.newData(targetState.value.pop())
  }
  handleHistory(dir:number) {
    const {targetState, targetHistory} = this.props
    const historyIndex = this.state.historyIndex + dir
    targetState.set(targetHistory[targetHistory.length-historyIndex-1])
    this.setState({historyIndex,historyLength:targetHistory.length})
  }
  handleRandom(count:number, pct:number) {
    const {targetState, targetHistory} = this.props
    this.historyTruncate()
    this.setState({historyIndex:0,historyLength:2}) // length is a lie but that's ok; we don't display it
    randomSequence(targetState, targetHistory, count, pct)
  }
  render() {
    const {targetState, targetHistory} = this.props
    const {historyIndex} = this.state
    return (
      <div className="EditBox">
        <form className="EditBoxEntry" onSubmit={handle(()=>this.handlePush())}>
          <label>
            <input type="text" value={this.state.entry} onInput={linkState(this, 'entry')} />
          </label>
          <input type="submit" disabled={!Boolean(this.state.entry)} value="Add" />
          <input type="button" onClick={handle(()=>this.handleShift())} value="Shift" />
          <input type="button" onClick={handle(()=>this.handlePop())} value="Pop" />
        </form>
        <div className="EditBoxSpacer">|</div>
        <div className="EditBoxSpecial">
          <a href="#" onClick={handle(()=>{optionWhitebox.set(true);this.setState({whitebox:true})})} className={this.state.whitebox ? "Highlighted" : undefined}>
            White Box
          </a>
          <a href="#" onClick={handle(()=>{optionWhitebox.set(false);this.setState({whitebox:false})})} className={this.state.whitebox ? undefined : "Highlighted"}>
            Black Box
          </a>
          <div className="EditBoxSpacer">|</div>
          <input type="button" disabled={historyIndex >= targetHistory.length-1}
            onClick={handle(()=>this.handleHistory(1))} value="<Hist" />
          <div className="EditBoxSpacer" style="width:3em; text-align:center">{historyIndex}</div>
          <input type="button" disabled={historyIndex <= 0}
            onClick={handle(()=>this.handleHistory(-1))} value="Hist>" />
          <div className="EditBoxSpacer">|</div>
          <input type="button" onClick={handle(()=>this.handleRandom(100, 2/3))} value="Random 100+" />
          <input type="button" onClick={handle(()=>this.handleRandom(100, 1/3))} value="Random 100-" />
          <input type="button" onClick={handle(()=>this.handleRandom(100000, 2/3))} value="Random 100000+" />
          <input type="button" onClick={handle(()=>this.handleRandom(100000, 1/3))} value="Random 100000-" />
        </div>
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

function listToDiv<T>(list:SortedList<T>) {
  const display = []
  let haveLast = false
  let last
  for(let x of list) {
    let good = true
    if (haveLast) {
      good = !(last > x)
    } else {
      haveLast = true
    }
    last = x
    display.push(<div className={good ? "NodeContentOrdered" : "NodeContentOrderedError"}>{typedFormat(x)}</div>)
  }
  return <div className="NodeDataOrdered">
    {display}
  </div>
}

function ListDisplay<T>({targetState}:{targetState:State<SortedList<T>>}) {
  const list = targetState.get()
  const whitebox = optionWhitebox.get()

  return <div className="ListDisplay">
    <div className="ListMeta">
      <div className="ListMetaItem">Size: <div className="DataNumber">{(list as any).size}</div></div>
      <div className="ListMetaItem">Depth: <div className="DataNumber">{(list as any)._level}</div></div>
    </div>
    <div className={whitebox ? "ListContent" : "ListContentOrdered"}>
      {whitebox ? nodeToDiv(list, (list as any)._root) : listToDiv(list)}
    </div>
  </div>
}

// ----- Display -----

let parentNode = document.getElementById("content")
let replaceNode = document.getElementById("initial-loading")

function Content() {
  return (
    <div className="Content">
      <ListEdit targetState={data} targetHistory={history} />
      <ListDisplay targetState={data} />
    </div>)
}

render(
  WrapStateContexts(<Content />, [data, optionWhitebox]),
  parentNode, replaceNode
)
