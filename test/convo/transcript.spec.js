const path = require('path')
const moment = require('moment')
const assert = require('chai').assert
const BotDriver = require('../../').BotDriver
const Capabilities = require('../../').Capabilities
const Events = require('../../').Events

const echoConnector = ({ queueBotSays }) => {
  return {
    UserSays (msg) {
      const botMsg = { sender: 'bot', sourceData: msg.sourceData, messageText: msg.messageText }
      queueBotSays(botMsg)
    }
  }
}

describe('convo.transcript', function () {
  beforeEach(async function () {
    const myCaps = {
      [Capabilities.PROJECTNAME]: 'convo.transcript',
      [Capabilities.CONTAINERMODE]: echoConnector
    }
    this.driver = new BotDriver(myCaps)
    this.compiler = this.driver.BuildCompiler()
    this.container = await this.driver.Build()
    await this.container.Start()
  })
  afterEach(async function () {
    await this.container.Stop()
    await this.container.Clean()
  })
  it('should provide transcript steps on success', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), '2steps.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    const transcript = await this.compiler.convos[0].Run(this.container)
    assert.isDefined(transcript)
    assert.isDefined(transcript.convoBegin)
    assert.isDefined(transcript.convoEnd)
    assert.isTrue(moment(transcript.convoBegin).isSameOrBefore(transcript.convoEnd), 'begin should be same or before end')
    assert.equal(transcript.steps.length, 4)
    transcript.steps.forEach(step => {
      assert.isDefined(step.stepBegin)
      assert.isDefined(step.stepEnd)
      assert.isTrue(moment(step.stepBegin).isSameOrBefore(step.stepEnd), 'begin should be same or before end')
    })
  })
  it('should provide transcript negated steps on success', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), '2stepsneg.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    const transcript = await this.compiler.convos[0].Run(this.container)
    assert.isDefined(transcript)
    assert.equal(transcript.steps.length, 2)
    assert.isTrue(transcript.steps[1].not)
  })
  it('should include pause in transcript steps', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), '2stepsWithPause.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    const transcript = await this.compiler.convos[0].Run(this.container)
    assert.isDefined(transcript)
    assert.isDefined(transcript.convoBegin)
    assert.isDefined(transcript.convoEnd)
    assert.isTrue(moment(transcript.convoEnd).diff(transcript.convoBegin) >= 1000, 'begin should be at least 1000 ms before end')
    assert.equal(transcript.steps.length, 4)
    assert.isTrue(moment(transcript.steps[2].stepEnd).diff(transcript.steps[2].stepBegin) >= 1000, 'begin should be at least 1000 ms before end')
  })
  it('should provide transcript steps on failing', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), '2stepsfailing.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    try {
      await this.compiler.convos[0].Run(this.container)
      assert.fail('expected error')
    } catch (err) {
      assert.isDefined(err.transcript)
      assert.equal(err.transcript.steps.length, 4)
      assert.equal(err.transcript.steps[0].actual.messageText, this.compiler.convos[0].conversation[0].messageText)
      assert.equal(err.transcript.steps[1].actual.messageText, this.compiler.convos[0].conversation[1].messageText)
      assert.equal(err.transcript.steps[2].actual.messageText, this.compiler.convos[0].conversation[2].messageText)
      assert.equal(err.transcript.steps[3].expected.messageText, this.compiler.convos[0].conversation[3].messageText)
      assert.notEqual(err.transcript.steps[3].actual.messageText, this.compiler.convos[0].conversation[3].messageText)
      assert.isDefined(err.transcript.steps[3].err)
    }
  })
  it('should provide transcript steps on invalid sender', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), 'invalidsender.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    try {
      await this.compiler.convos[0].Run(this.container)
      assert.fail('expected error')
    } catch (err) {
      assert.isDefined(err.transcript)
      assert.equal(err.transcript.steps.length, 1)
      assert.isDefined(err.transcript.steps[0].err)
    }
  })
  it('should emit transcript event on success', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), '2steps.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    let transcript = null
    this.driver.on(Events.MESSAGE_TRANSCRIPT, (container, transcriptEv) => { transcript = transcriptEv })

    await this.compiler.convos[0].Run(this.container)
    assert.isDefined(transcript)
  })
  it('should emit transcript event on failure', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), '2stepsfailing.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    let transcript = null
    this.driver.on(Events.MESSAGE_TRANSCRIPT, (container, transcriptEv) => { transcript = transcriptEv })

    try {
      await this.compiler.convos[0].Run(this.container)
      assert.fail('expected error')
    } catch (err) {
      assert.isDefined(transcript)
    }
  })
  it('should handle expected JSON response', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), 'json-matching-key-and-value.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    let transcript = null
    this.driver.on(Events.MESSAGE_TRANSCRIPT, (container, transcriptEv) => { transcript = transcriptEv })

    await this.compiler.convos[0].Run(this.container).then(() => {
      assert.isDefined(transcript)
    }, error => {
      assert.fail('unexpected error', error)
    })
  })
  it('should handle fail with mismatching key in JSON response', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), 'json-mismatching-key.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    let transcript = null
    let container = null
    this.driver.on(Events.MESSAGE_TRANSCRIPT, (container, transcriptEv) => { container = container; transcript = transcriptEv })

    await this.compiler.convos[0].Run(this.container).then(() => {
      assert.fail('expected error')
    }, error => {
      assert.isDefined(transcript)
    })
  })
  it('should handle fail with mismatching value in JSON response', async function () {
    this.compiler.ReadScript(path.resolve(__dirname, 'convos'), 'json-mismatching-value.convo.txt')
    assert.equal(this.compiler.convos.length, 1)

    let transcript = null
    this.driver.on(Events.MESSAGE_TRANSCRIPT, (container, transcriptEv) => { transcript = transcriptEv })

    await this.compiler.convos[0].Run(this.container).then(() => {
      assert.fail('expected error')
    }, err => {
      assert.isDefined(transcript)
    })
  })
})
