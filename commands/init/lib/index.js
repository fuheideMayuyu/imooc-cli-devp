'use strict';

const fs = require('fs')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const Command = require('@imooc-cli-devp/conmand')
const log = require('@imooc-cli-devp/log')

class InitCommand extends Command {
  init(){
    this.projectName = this._argv[0] || ''
    if(this._argv && this._argv.length > 0) {
      this._argv.forEach(item => {
        if(item.force){
          this.force = !! item.force
        }
      });
    }
    log.verbose('projectName', this.projectName)
    log.verbose('force', this.force)
  }

  async exec(){
    try{
      // 1.准备阶段
      await this.prepare()
      // 2. 下载模板
      // 3. 安装模板
    } catch(e){
      log.error(e.message);
    }
  }
  async prepare(){
    const localPath = process.cwd()
    // 1. 判断当前目录是否为空
    const ret = this.isDirEmpty(localPath)
    if(!ret){
      // 1.1 询问是否继续创建
      const { ifContinue } = await  inquirer.prompt({
        type: 'confirm',
        name: 'ifContinue',
        default: false,
        message: '当前文件夹不为空，是否继续创建项目?'
      })
      console.log(ifContinue);
       // 2. 是否启动强制更新
      if(ifContinue){
        // 清空当前目录 慎重操作
        console.log('清空目录');
        fse.emptyDirSync(localPath)
      }
    }
   
    // 3. 选择创建项目或组件
    // 4. 获取项目的基本信息

  }
  isDirEmpty(localPath){
    let fileList = fs.readdirSync(localPath)
    // 文件过滤逻辑
    fileList = fileList.filter(file => (
      !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    ))
    return !fileList || fileList.length <= 0
  }
}


function init(argv) {
  return new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand;