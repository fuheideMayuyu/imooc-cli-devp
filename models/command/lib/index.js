'use strict';

const semver = require('semver')
const colors = require('colors')

const log = require('@imooc-cli-devp/log')

const LOWEST_NODE_VERSION = '12.0.0'

class Command {
  constructor(argv){
    argv = JSON.parse(argv)
    if(!argv){
      throw new Error('参数不能为空！')
    }
    if(!Array.isArray(argv)){
      throw new Error('参数必须为数组！')
    }
    if(argv.length < 1){
      throw new Error('参数不列表为空！')
    }
    this._argv = argv
    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve()
      chain = chain.then(() => this.checkNodeVersion())
      chain = chain.then(() => this.initArgs())
      chain = chain.then(() => this.init())
      chain = chain.then(() => this.exec())
      chain.catch(e => {
        log.error(e.message)
      })
    })
  }

  init(){
    console.log('执行init');
  }

  // 初始化参数
  initArgs(){
    this._cmd = this._argv[this._argv.length - 1]
    this._argv = this._argv.slice(0, this._argv.length - 1)
  }

  //检测NODE版本号
  checkNodeVersion(){
    const currentVersion = process.version
    const lowestVersion = LOWEST_NODE_VERSION
    if(!semver.gte(currentVersion, lowestVersion)){
      throw new Error(colors.red(`imooc-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`))
    }
  }
  exec(){
    console.log('执行exec');
  }
}

module.exports = Command;