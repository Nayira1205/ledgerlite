const mongoose = require('mongoose');

// Runs `work(session)` as ONE database transaction: either every change inside it is saved,
// or none of them is.
//
//  1. startSession()      - a session is the "envelope" that groups the operations.
//  2. withTransaction()   - begins the transaction, runs our function, then COMMITS.
//                           If our function throws, it ABORTS: every change is undone.
//                           If MongoDB reports a temporary clash (for example two requests
//                           changing the same wallet at the same moment), it runs our function
//                           again automatically. That is why `work` must not have side effects
//                           outside the database.
//  3. endSession()        - always release the session, success or failure.
//
// Every database call inside `work` must receive the `session`, otherwise it runs OUTSIDE
// the transaction and would not be undone.
async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
    );
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = withTransaction;