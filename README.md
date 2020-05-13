# code-harmony

Make your code more readable by making the functions work in harmony with each other.

- Proivdes an interface to write code in a more granular format.
- Allows the sharing of resources between various worker functions to reduce duplicate data fetching or generating.

## Install

```bash
npm install code-harmony
```

## Usage
```js
// this is an example of a context creating function
// can be any asynchronous call which
// resolves with an object containing data
// the data is then populated in the context object
// which is available to the worker functions
function fetchUserData(subscribedData) {
  const user = await fetchUserFromDB();
  return Promise.resolve({ userId: user.id });
}

// this is an example of a worker function
function applyOfferA(subscribedData, context) {
  console.log(context) // -> { userId: 1234 }
  return Promise.resolve();
}

const CodeHarmony = require('code-harmony');

new CodeHarmony(subscribedData)
  .context(fetchUserData)
  .serially(applyOfferA, applyOfferB)
  .parallelly(emailInvoice, smsInvoice)
  .finish()
  .then() // resolves when all the tasks finishes
  .catch(logger.error); // action can be taken on any error here
```

## Resources

- [Changelog](https://github.com/thakursaurabh1998/code-harmony/blob/master/CHANGELOG.md)

## License

[MIT License](https://choosealicense.com/licenses/mit/)
