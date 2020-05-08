import { useState, useEffect } from "react"

// takeUntil(event)
// vs
// cancel(task)

// fetch something
// update the ui
// fetch something else with the content of prev request

// cancel a request, take login/logout example
// only listen to events when in certain state

function AutoComplete() {
  const [state, actions] = useHooker(
    { query: '', items: Remote.NotAsked },
    {
      changedQuery: query => a => {
        put(s => ({ ...s, query, result: Remote.Loading }))
        latest(fetchResult(query), a.receiveResult)
      },
      receiveResult: result => a => put(s => ({ ...s, result })),
    }
  )

  actions.
}
