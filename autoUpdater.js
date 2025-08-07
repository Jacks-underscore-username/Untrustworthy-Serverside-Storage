const { spawn, execSync } = require('node:child_process')
const axios = require('axios')
const path = require('node:path')

const mode = process.argv[2]
if (mode !== 'server' && mode !== 'relay') throw new Error("Mode must either be 'server' or 'relay'")

const startPath = process.cwd()
;(async () => {
  while (true) {
    console.clear()
    console.log(`Pulling latest version of the ${mode}...`)
    const lastHash = (
      await axios.get(
        'https://api.github.com/repos/Jacks-underscore-username/Untrustworthy-Serverside-Storage/branches/main'
      )
    ).data.commit.sha
    process.chdir(startPath)
    execSync('git stash', { stdio: 'inherit' })
    execSync('git pull --force', { stdio: 'inherit' })
    execSync('git stash clear', { stdio: 'inherit' })
    process.chdir(path.join(startPath, mode))
    console.log(`Running ${mode}`)
    const child = spawn('bun main.js', { stdio: 'inherit', shell: true })
    process.on('exit', () => child.kill())
    await new Promise(async resolve => {
      while (true) {
        const currentHash = (
          await axios.get(
            'https://api.github.com/repos/Jacks-underscore-username/Untrustworthy-Serverside-Storage/branches/main'
          )
        ).data.commit.sha
        if (lastHash !== currentHash) {
          child.kill()
          resolve(undefined)
        }
        await new Promise(r => setTimeout(r, 15_000))
      }
    })
  }
})()
