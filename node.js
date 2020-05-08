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

const Task = fork => ({
  fork,
  of: Task.of,
  chain: f => {
    return Task((reject, resolve) => fork(reject, x => f(x).fork(reject, resolve)))
  },
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

function update(action) {
  return function* gen() {
    yield modify({ username: action })
    const state = yield get()
    const url = yield call(`http://twitter.com/${state.username}`, {})
    yield modify({ url })
  }
}

function run(fa, state = {}) {
  return fa.cata({
    Pure: Task.of,
    Impure: (x, f) =>
      x.cata({
        Get: _ => Task.of(state).chain(y => run(f(y), state)),
        Modify: newState =>
          Task.of({ ...state, ...newState })
            .chain(y => run(f(y), y)),
        Call: url =>
          Task.of(url)
            .chain(y => run(f(y), state)),
      }),
  })
}

function* life(initialState, updater, render) {
  let state = initialState
  while(true) {
    run(Monad.do(updater(yield {}), Free).chain(get), state)
      .fork(_ => {}, render)
  }
}

const it = life({}, update, state => console.log(state))
it.next()
it.next("vikfroberg")
it.next("fnaz")
