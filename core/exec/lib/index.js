'use strict';

const path = require('path')

const Package = require("@imooc-cli-devp/package")
const log = require('@imooc-cli-devp/log')
const { exec: spawn } = require('@imooc-cli-devp/utils')

const SETTINGS = {
  init: '@imooc-cli/init'
}

const CACHE_DIR = 'dependencies'

async function exec() {
  let targetPath = process.env.CLI_TARGET_PATH
  const homePath = process.env.CLI_HOME_PATH
  let storeDir = ''
  let pkg
  log.verbose('targetPath', targetPath)
  log.verbose('homePath', homePath)  

  const cmdName = arguments[arguments.length - 1].name()
  const packageName = SETTINGS[cmdName]
  const packageVersion = 'latest'
  if(!targetPath){
    // 生成缓存路径
    targetPath = path.resolve(homePath, CACHE_DIR)
    storeDir = path.resolve(targetPath, 'node_modules')
    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
    if(await pkg.exists()){
      // 更新pkg
      await pkg.update()
    } else {
      // 安装pkg
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      packageName,
      packageVersion
    })
  }
  const rootFile =  pkg.getRootFilePath()
  if(rootFile){
    try{
      const args = Array.from(arguments)
      
      const cmd = args[args.length - 1]
      const o = Object.create(null)
      Object.keys(cmd).forEach(key => {
        if(cmd.hasOwnProperty(key) && !key.startsWith("_") && key !== 'parent') {
          o[key] = cmd[key]
        }
      })
      args[args.length - 1] = o
      const code = `require('${rootFile}').call(null, '${JSON.stringify(args)}')`
      const child = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit'
      })

      child.on('error', e=> {
        log.error(e.message)
        process.exit(1)
      })

      child.on('exit', e=> {
        log.verbose('命令执行成功：' + e)
        process.exit(e)
      })
    } catch (e) {
      log.error(e.message);
    }
  }
}

module.exports = exec;