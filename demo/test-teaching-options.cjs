const assert = require('node:assert/strict');
const { Script } = require('node:vm');
const { teachingOptions } = require('./teaching-options');
const original = { ...teachingOptions };
const keys = Object.keys(original);

try {
  for (let mask = 0; mask < 2 ** keys.length; mask++) {
    keys.forEach((key, index) => { teachingOptions[key] = Boolean(mask & (1 << index)); });
    delete require.cache[require.resolve('./scenarios')];
    const { scenarios, program } = require('./scenarios');
    const ids = scenarios.map(scenario => scenario.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.includes('library-model'), teachingOptions.libraryModel);
    assert.equal(ids.includes('repaired-disclosure'), teachingOptions.upgradeDisclosure);
    assert.equal(ids.includes('declassified'), teachingOptions.declassification);
    assert.equal(ids.length, 9 + Number(teachingOptions.libraryModel) + Number(teachingOptions.upgradeDisclosure) + Number(teachingOptions.declassification));
    for (const scenario of scenarios) new Script(program(scenario, 'test "token"', true));
    const deferred = scenarios.find(scenario => scenario.id === 'deferred');
    assert.equal(deferred.body.includes('var delay = 1000;'), teachingOptions.fixedTimers);
    assert.equal(deferred.body.includes('Math.random()'), !teachingOptions.fixedTimers);
  }
  console.log('PASS: all 32 independent teaching-option combinations, original nine examples when disabled, generated program syntax.');
} finally {
  Object.assign(teachingOptions, original);
  delete require.cache[require.resolve('./scenarios')];
}
