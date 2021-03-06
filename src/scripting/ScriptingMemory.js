const util = require('util')
const debug = require('debug')('botium-ScriptingMemory')
const randomize = require('randomatic')
const uuidv1 = require('uuid/v1')
const moment = require('moment')

const Capabilities = require('../Capabilities')

const SCRIPTING_FUNCTIONS = {
  '$now': () => {
    return new Date().toLocaleString()
  },
  '$date': () => {
    return new Date().toLocaleDateString()
  },
  '$year': () => {
    return new Date().getFullYear()
  },
  '$month': () => {
    return moment().format('MMMM')
  },
  '$day_of_month': () => {
    return new Date().getDate()
  },
  '$day_of_week': () => {
    return moment().format('dddd')
  },
  '$now_ISO': () => {
    return new Date().toISOString()
  },
  '$time': () => {
    return new Date().toLocaleTimeString()
  },
  '$random10': () => {
    return randomize('0', 10)
  },
  '$uniqid': () => {
    return uuidv1()
  }
}

const RESERVED_WORDS = Object.keys(SCRIPTING_FUNCTIONS)

const apply = (container, scriptingMemory, str) => {
  if (container.caps[Capabilities.SCRIPTING_ENABLE_MEMORY]) {
    str = _apply(scriptingMemory, str)
  }
  return str
}

const applyToArgs = (args, scriptingMemory) => {
  return (args || []).map(arg => {
    return _apply(scriptingMemory, arg)
  })
}

const _apply = (scriptingMemory, str) => {
  // we have two replace longer variable first. if there is $year, and $years, $years should not be found by $year
  const longestFirst = (a, b) => b.length - a.length

  if (str) {
    Object.keys(SCRIPTING_FUNCTIONS).sort(longestFirst).forEach((key) => {
      const stronger = Object.keys(scriptingMemory).filter((variableName) => variableName.startsWith(key))
      if (stronger.length === 0) {
        str = str.replace(key, SCRIPTING_FUNCTIONS[key]())
      }
    })
    Object.keys(scriptingMemory).sort(longestFirst).forEach((key) => {
      str = str.replace(key, scriptingMemory[key])
    })

    // _.forOwn(SCRIPTING_FUNCTIONS, (func, key) => {
    //   const stronger = Object.keys(scriptingMemory).filter((variableName) => variableName.startsWith(key))
    //   if (stronger.length === 0) {
    //     str = str.replace(key, func())
    //   }
    // })
    // // forOwn iterates first the longest names, what is good.
    // // if we have two overlapping variables like year and years, years must be replaced first
    // _.forOwn(scriptingMemory, (value, key) => {
    //   str = str.replace(key, value)
    // })
  }
  return str
}

const fill = (container, scriptingMemory, result, utterance, scriptingEvents) => {
  debug(`fill start: ${util.inspect(scriptingMemory)}`)
  if (result && utterance && container.caps[Capabilities.SCRIPTING_ENABLE_MEMORY]) {
    const utterances = scriptingEvents.resolveUtterance({ utterance })
    utterances.forEach(expected => {
      let reExpected = expected
      if (container.caps[Capabilities.SCRIPTING_MATCHING_MODE] !== 'regexp') {
        reExpected = expected.replace(/[-\\^*+?.()|[\]{}]/g, '\\$&')
      }
      const varMatches = expected.match(/\$\w+/g) || []
      for (let i = 0; i < varMatches.length; i++) {
        reExpected = reExpected.replace(varMatches[i], '(\\w+)')
      }
      const resultMatches = result.match(reExpected) || []
      for (let i = 1; i < resultMatches.length; i++) {
        if (i <= varMatches.length) {
          const varName = varMatches[i - 1]
          if (RESERVED_WORDS.indexOf(varName) >= 0) {
            debug(`fill Reserved word "${varName}" used as variable`)
          }
          scriptingMemory[varName] = resultMatches[i]
        }
      }
    })
    debug(`fill end: ${util.inspect(scriptingMemory)}`)
  }
}

module.exports = {
  apply,
  applyToArgs,
  fill,
  RESERVED_WORDS
}
