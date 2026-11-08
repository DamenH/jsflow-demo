// ES5 teaching templates. User inputs are inserted only as JSON literals.
const { teachingOptions } = require('./teaching-options');
const timerHelper = 'function defer(callback, value) {\n    var delay = ' +
  (teachingOptions.fixedTimers ? '1000' : '500 + Math.floor(Math.random() * 1000)') +
  ';\n    setTimeout(function () {\n        callback(value);\n    }, delay);\n}\n';
const scenarios = [
  { id: 'direct', title: 'Steal the token', tag: 'Explicit flow', question: 'Can an analytics script publish a private token?', lesson: 'Copying a secret into a public message preserves its secret label.', body: "var message = 'token=' + token;\ncheckpoint('Analytics prepares a message', message);\npublicOutput(message);" },
  { id: 'encoded', title: 'Hide it in an encoding', tag: 'API propagation', question: 'Does encoding the token make it safe to send?', lesson: 'encodeURIComponent changes the text, but the value still depends on the secret.', body: "var message = encodeURIComponent(token);\ncheckpoint('Encode the private token', message);\npublicOutput(message);" },
  { id: 'implicit', title: 'Leak one bit', tag: 'Implicit flow', question: 'What if the message contains no secret characters?', lesson: 'The message is a public constant. The decision to send it depends on a secret, so the execution context is secret.', body: "if (isMember) {\n    checkpoint('Secret branch: member', 'MEMBER');\n    publicOutput('MEMBER');\n} else {\n    checkpoint('Secret branch: guest', 'GUEST');\n    publicOutput('GUEST');\n}" },
  { id: 'safe', title: 'Keep the result private', tag: 'Allowed computation', question: 'Can private computation coexist with useful public output?', lesson: 'The derived value stays secret. A constant emitted outside secret control is allowed.', body: "var size = token.length;\ncheckpoint('Compute token length privately', size);\npublicOutput('Page view recorded');" },
  { id: 'nsu', title: 'Hit a conservative check', tag: 'No sensitive upgrade', question: 'Will JSFlow accept this, even without a public disclosure?', lesson: 'It rejects the assignment to a public variable under secret control, even though this program never sends that value to the public inbox.', body: "var result = 0;\ncheckpoint('Destination starts public', result);\nif (isMember) {\n    checkpoint('About to update under secret control', result);\n    result = 1;\n}\ncheckpoint('Private computation finished', result);" },
  { id: 'repaired', title: 'Prelabel the destination', tag: 'Allowed implicit flow', question: 'Can we keep the computation and satisfy the check?', lesson: 'Labeling the destination before the branch lets the secret assignment proceed. The result remains private.', body: "var result = lbl(0);\ncheckpoint('Destination starts secret', result);\nif (isMember) {\n    checkpoint('About to update under secret control', result);\n    result = 1;\n}\ncheckpoint('Private computation finished', result);\npublicOutput('Page view recorded');" },
  { id: 'callback', title: 'Pass a secret to a callback', tag: 'Synchronous callback', question: 'Does a callback argument keep its security label?', lesson: 'Calling a function through a callback does not remove dependencies. Step into send: its result parameter retains the secret label.', body: "function process(value, callback) {\n    var encoded = encodeURIComponent(value);\n    callback(encoded);\n}\nprocess(token, function send(result) {\n    publicOutput(result);\n});" },
  { id: 'deferred', title: teachingOptions.fixedTimers ? 'Send it after a delay' : 'Send it after a random delay', tag: 'Timer callback', question: 'Does waiting remove the secret label?', lesson: teachingOptions.fixedTimers ? 'The helper waits 1000 ms. The main script finishes first, then the callback receives the secret-labeled argument and disclosure is blocked. Edit the delay expression to explore other delays.' : 'The inline helper chooses a random 500–1499 ms delay. The main script finishes first, then the callback receives the same secret-labeled argument and its disclosure is blocked.', body: timerHelper + "defer(function sendLater(value) {\n    publicOutput(value);\n}, token);\npublicOutput('Main script finished');" },
  { id: 'deferred-control', title: 'Schedule under secret control', tag: 'Timer implicit flow', question: 'Can scheduling a callback reveal one private bit?', lesson: 'The timer model retains the scheduling context, so a callback scheduled under secret control cannot publish a public constant.', body: timerHelper + "if (isMember) {\n    defer(function announce() {\n        publicOutput('Member callback ran');\n    });\n}\npublicOutput('Main script finished');" }

];
if (teachingOptions.upgradeDisclosure) {
  scenarios.splice(scenarios.findIndex(scenario => scenario.id === 'repaired') + 1, 0, {
    id: 'repaired-disclosure',
    title: 'The upgraded result is still private',
    tag: 'Upgrade and disclosure',
    question: 'Does prelabeling grant permission to publish the result?',
    lesson: 'Compare the three examples: the public destination rejects the assignment; prelabeling permits private computation; publishing the resulting secret is still rejected. The public page-view message goes through before that rejection.',
    body: "var result = lbl(0);\nif (isMember) {\n    result = 1;\n}\npublicOutput('Page view recorded');\npublicOutput(result);",
  });
}

if (teachingOptions.libraryModel) {
  scenarios.splice(scenarios.findIndex(scenario => scenario.id === 'callback') + 1, 0, {
    id: 'library-model',
    title: 'A library decides which getter runs',
    tag: 'Library control flow',
    question: 'Can a library reveal a secret through a getter side effect?',
    lesson: 'Array.every stops at the first false result. A secret true result causes it to read the next element, invoking a getter under secret control. JSFlow rejects the getter’s write to the public visited variable. Step over the every call to observe the check; this synchronous library call cannot pause internally.',
    body: "var visited = false;\nvar values = [isMember, true];\nObject.defineProperty(values, '1', {\n    get: function nextValue() {\n        visited = true;\n        return true;\n    }\n});\nvalues.every(function keepGoing(value) {\n    return value;\n});\npublicOutput(visited);",
  });
}

if (teachingOptions.declassification) {
  scenarios.push({
    id: 'declassified',
    title: 'Explicitly remove a value’s protection',
    tag: 'Advanced: declassification',
    question: 'What happens when the program can declassify its own data?',
    lesson: 'The artifact exposes declassify without an authorization check. Here it changes the released value’s label to public, so our public sink accepts it. This deliberately exercises release authority; it is not evidence that the original secret was public.',
    body: "var released = declassify(token);\npublicOutput(released);",
  });
}

function program(scenario, token, isMember) {
  return 'var token = lbl(' + JSON.stringify(token) + ');\n' +
    'var isMember = lbl(' + JSON.stringify(isMember) + ');\n' +
    "checkpoint('Read private token', token);\n" + scenario.body;
}
module.exports = { scenarios, program };
