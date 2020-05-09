// In a race effect. All race competitors, except the winner, are automatically cancelled.
// In a parallel effect (yield all([...])). The parallel effect is rejected as soon as one of the sub-effects is rejected (as implied by Promise.all). In this case, all the other sub-effects are automatically cancelled.

const Effect = {}
Effect.get = () => ({
  cata: fs => fs.Get(),
})
Effect.modify = newState => ({
  newState,
  cata: fs => fs.Modify(newState),
})
Effect.call = url => ({
  url,
  cata: fs => fs.Call(url),
})

const get = _ => liftF(Effect.get())
const modify = a => liftF(Effect.modify(a))
const call = a => liftF(Effect.call(a))

const compose = (f, g) => x => f(g(x))

const Task = fork => ({
  fork,
  of: Task.of,
  chain: f => {
    return Task((reject, resolve) => fork(reject, x => f(x).fork(reject, resolve)))
  },
  map: f => Monad.map(f)(Task(fork)),
})
Task.of = x => { return Task((_, resolve) => resolve(x)) }
Task.rejected = x => { return Task((reject, _) => reject(x)) }

const Monad = {}
Monad.chain = f => m => { return m.chain(f) }
Monad.map = f => m => { return m.chain(x => m.of(f(x))) }
Monad.ap = mf => ma => { return mf.chain(g => Monad.map(g, ma)) }
Monad.do = (gen, M) => {
  const it = gen()
  function step(acc) {
    const { done, value } = it.next(acc)
    if (done) {
      return M.of(value)
    } else {
      return value.chain(step)
    }
  }
  return step(null)
}

const Free = {}
Free.Pure = x => ({
  type: "Pure",
  x,
  of: Free.Pure,
  chain: g => g(x),
  cata: fs => fs.Pure(x),
})
Free.Impure = (x, f) => ({
  type: "Impure",
  x,
  f,
  of: Free.Pure,
  chain: g => Free.Impure(x, y => f(y).chain(g)),
  cata: fs => fs.Impure(x, f),
})
Free.of = Free.Pure

const liftF = a => Free.Impure(a, Free.Pure)

function pipe(x, fs) {
  return fs.reduce((acc, f) => f(acc), x)
}

function* update(action) {
  yield modify({ username: action })
  const state = yield get()
  const url = yield call(`http://twitter.com/${state.username}`, {})
  yield modify({ url })
}

const toTask = (getState, setState) => fa => {
  return fa.cata({
    Pure: Task.of,
    Impure: (x, f) =>
      x.cata({
        Get: _ =>
          getState
            .chain(compose(toTask(getState, setState), f)),
        Modify: newState =>
          getState
            .map(state => ({ ...state, ...newState }))
            .chain(setState)
            .chain(compose(toTask(getState, setState), f)),
        Call: url =>
          Task.of(url)
            .chain(compose(toTask(getState, setState), f)),
      }),
  })
}

function* run({ updater, getState, setState }) {
  while(true) {
    const action = yield {}
    toTask(getState, setState)(Monad.do(() => updater(action), Free))
      .chain(_ => getState)
      .fork(
        error => console.log("error", error),
        result => console.log("result", result),
      )
  }
}

let initialState = {}
const it = run({
  updater: update,
  getState: Task((_, resolve) => resolve(initialState)),
  setState: newState =>
    Task((_, resolve) => {
      initialState = newState
      resolve(newState)
    })
})
it.next()
it.next("vikfroberg")
it.next("fnaz")
