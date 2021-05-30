'use strict';

const path = require('path')
const Package = require("@imooc-cli-devp/package")
const log = require('@imooc-cli-devp/log')

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
  console.log( await pkg.exists());
  const rootFile =  pkg.getRootFilePath()
  if(rootFile){
    require(rootFile).apply(null, arguments)
  }
}

module.exports = exec;