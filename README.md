# Setup check

Checks that your machine can run the tools used in the hands-on session:
Node, your Anthropic API key, the two models we'll use, the weather service
and port 3000. It contains none of the exercise.

You need Node 22 or later and the API key we sent you.

```sh
export ANTHROPIC_API_KEY=<the key we sent you>
npm install && npm run preflight
```

It's done when you see:

```
Setup works.
```

If something fails, it names the check and a one-line fix. The checks:

- **Node 22 or later.** Install a newer Node from https://nodejs.org.
- **ANTHROPIC_API_KEY is set.** Export the key in the shell you run this from.
- **Models `claude-haiku-4-5` and `claude-sonnet-5` answer.** Each one gets a
  one-line request through the Claude Agent SDK. A failure here is usually a
  mistyped key or a network that blocks api.anthropic.com. Each check gives
  up after 60 seconds.
- **api.weather.gov answers.** The session uses the US National Weather
  Service. If it fails, check your VPN or proxy.
- **Port 3000 is free.** The session runs a small web page there. Stop
  whatever is using it; `lsof -i :3000` shows what.

For anything else, send us the output.

## Before the session

- Send us your GitHub username a day or two ahead, so we can add you to the
  private exercise repository at the start of the session.
- During the exercise, please commit and push checkpoints as you go, so we
  can follow along.
