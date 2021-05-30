'use strict';

const path = require('path')
const commander = require('commander')
const pathExists = require('path-exists').sync;
const userHome = require('user-home');
const semver = require('semver')
const colors = require('colors')
const log = require('@imooc-cli-devp/log')
const init = require('@imooc-cli-devp/init')
const exec = require('@imooc-cli-devp/exec')

const constant = require('./const');
const pkg = require('../package.json')

let program = new commander.Command()

async function core() {
  try{
    await prepare()
    registerCommand()
  } catch(e){
    log.error(e.message)
    if(program.opts().debug){
      console.log(e);
    }
  }
}

// 初始化commander
function registerCommand(){
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')

  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec)
  const options = program.opts();
  // 开启debug模式，参数不能有空格
  program.on('option:debug', function(){
    if(options.debug){
      process.env.LOG_LEVEL = 'verbose'
    } else {
      process.env.LOG_LEVEL = 'info'
    }
    log.level = process.env.LOG_LEVEL
  })

  // 指定targetPath
  program.on('option:targetPath', function(){
    process.env.CLI_TARGET_PATH = options.targetPath
  })

  //对未知命令监听
  program.on('command:*', function(obj){
    const availableCommands = program.commands.map(cmd => cmd.name())
    console.log(colors.red('未知的命令:' + obj[0]))
    if(availableCommands.length > 0) {
      console.log(colors.red('可用命令:' + availableCommands.join(',')))
    }
  })

  program.parse(process.argv)
  if(program.args && program.args.length < 1) {
    program.outputHelp()
    console.log()
  }
}

async function prepare(){
  checkPkgVersion()
  checkNodeVersion()
  checkRoot()
  checkUserHome()
  checkEnv()
  await checkGlobalUpdate()
  
}

// 检测是否需要全局更新
async function checkGlobalUpdate(){
  // 获取当前版本号和模块名
  const currentVersion = pkg.version
  const npmName = pkg.name
  // 调用npm API, 获取所有版本号
  const { getNpmSemverVersion } = require('@imooc-cli-devp/get-npm-info')
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName)
  // 提取所有版本号，比对哪些版本号是大于当前版本号
  // 获取最新版本号，提示用户更新到该版本
  if(lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn( colors.yellow(`请手动更新${npmName}, 当前版本：${currentVersion}, 最新版本：${lastVersion}， 更新命令： npm install -g ${npmName}`))
  }
}

// 检测环境变量
function checkEnv(){
  const dotenv = require('dotenv')
  const dotenvPath = path.resolve(userHome, '.env')
  if(pathExists(dotenvPath)){
    dotenv.config({
      path: dotenvPath
    })
  }
  createDefaultConfig()
}

// 创建ci默认配置
function createDefaultConfig(){
  const cliConfig = {
    home: userHome
  }
  if(process.env.CLI_HOME){
    cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
  } else {
    cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome
}

// 检测用户主目录
function checkUserHome() {
  if(!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在！'))
  }
}
// 检测是否为Root账户
function checkRoot(){
  const rootCheck = require('root-check')
  rootCheck()
}
//检测NODE版本号
function checkNodeVersion(){
  const currentVersion = process.version
  const lowestVersion = constant.LOWEST_NODE_VERSION
  if(!semver.gte(currentVersion, lowestVersion)){
    throw new Error(colors.red(`imooc-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`))
  }
}
// 检测版本号
function checkPkgVersion(){
  log.info('cli', pkg.version)
}

module.exports = core;