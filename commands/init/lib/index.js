'use strict';

const fs = require('fs')
const glob = require('glob')
const ejs = require('ejs')
const path = require('path')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const semver = require('semver')
const userHome = require('user-home')
const Command = require('@imooc-cli-devp/conmand')
const log = require('@imooc-cli-devp/log');
const { spinnerStart, sleep, execAsync } = require('@imooc-cli-devp/utils');
const Package = require('@imooc-cli-devp/package');

const getProjectTemplate = require('./getProjectTemplate');
const TYPE_PROJECT = 'project'
const TYPE_COMPOENT = 'component'
const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'
const WHITE_COMMAND = ['npm', 'cnpm']

class InitCommand extends Command {
  init(){
    this.projectName = this._argv[0] || ''
    if(this._argv && this._argv.length > 0) {
      this._argv.forEach(item => {
        if(item && item.force){
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
      const projectInfo = await this.prepare()
      if(projectInfo){
        // 2. 下载模板
        log.verbose('projectInfo', projectInfo)
        this.projectInfo = projectInfo
        await this.downloadTemplate()
        // 3. 安装模板
        this.installTemplate()
      }
    } catch(e){
      log.error(e.message);
      if(process.env.LOG_LEVEL === 'verbose'){
        console.log(e)
      }
    }
  }

  async installTemplate(){
    log.verbose('template', this.templateInfo)
    if(this.templateInfo) {
      if(!this.templateInfo.type){
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL
      } 
      if(this.templateInfo.type = TEMPLATE_TYPE_NORMAL){
        // 标准安装
        await this.installNormalTemplate()
      } else if(this.templateInfo.type = TEMPLATE_TYPE_CUSTOM){
        // 自定义安装
        await this.installCustomTemplate()
      } else {
        throw new Error('项目模板类型无法识别！')
      }
    } else {
      throw new Error('项目模板信息不存在！')
    }
  }

  checkCommand(cmd){
    if(WHITE_COMMAND.includes(cmd)){
      return cmd
    }
    return null
  }

  async execCommand(command, errMsg){
    let ret
    if(command){
      const cmdArray = command.split(' ')
      const cmd = this.checkCommand(cmdArray[0]) 
      if(!cmd){
        throw new Error('命令不存在！命令：' + command)
      }
      const args = cmdArray.slice(1)
      ret = await execAsync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd()
      })
    }
    if(ret !== 0){
      throw new Error(errMsg)
    }
    return ret
  }

  // ejs 模板渲染
  async ejsRender(options){
    const dir = process.cwd()
    const projectInfo = this.projectInfo
    return new Promise((resolve, reject) => {
      glob("**", {
        cwd: dir,
        ignore: options.ignore,
        nodir: true
      }, (err, files) => {
        if(err) {
          reject(err)
        }
        Promise.all(files.map(file => {
          const filePth = path.join(dir,file)
          return new Promise((resolve1, reject1) => {
            ejs.renderFile(filePth, projectInfo, {}, (err, result) => {
              if(err){
                reject1(err)
              } else {
                fse.writeFileSync(filePth, result)
                resolve1(result)
              }
            })
          })
        })).then(() =>{
          resolve()
        }).catch(err => {
          reject(err)
        })
      })
    })
  }

  async  installNormalTemplate(){
    log.verbose('templateNpm', this.templateNpm)
    // 拷贝模板代码至当前目录
    let spinner = spinnerStart('正在安装模板')
    try{
      const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
      const targetPath = process.cwd()
      fse.ensureDirSync(templatePath)
      fse.ensureDirSync(targetPath)
      fse.copySync(templatePath, targetPath)
    } catch (e) {
      throw e
    } finally {
      spinner.stop(true)
      log.success('模板安装成功！')
    }
    const templateIgnore = this.templateInfo.ignore || []
    const ignore = ['**/node_modules/**', ...templateIgnore]
    await this.ejsRender({ignore})
    const { installCommand, startCommand } = this.templateInfo
    // 依赖安装
    await this.execCommand(installCommand, '依赖安装过程中失败！')
    // 启动命令
    await this.execCommand(startCommand, '项目启动过程中失败！')
  }

  async installCustomTemplate(){
    const rootFile = this.templateNpm.getRootFilePath();
    if(await this.templateNpm.exists()){
      if(fs.existsSync(rootFile)){
        log.notice('开始执行自定义模板')
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd()
        }
        const code = `require('${rootFile}')('${JSON.stringify(options)}')`
        log.verbose('code', code)

        await execAsync('node', ['-e', code], {
          stdio: 'inherit',
          cwd: process.cwd()
        })
        log.success('自定义模板安装成功')
      } else {
        throw new Error('自定义模板入口文件不存在！')
      }
    }
  }

  async downloadTemplate(){
    // 1. 通过项目模板API获取项目模板信息
    // 1.1 通过egg.js搭建一套后端系统
    // 1.2通过npm存储项目模板
    // 1.3将项目模板信息存储到mongodb数据中
    // 1.4通过egg.js获取mongodb中的数据并且通过API返回
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    const targetPath = path.resolve(userHome, '.imooc-cli-devp', 'template')
    const storeDir = path.resolve(userHome, '.imooc-cli-devp', 'template', 'node_modules')
    const { npmName, version } = templateInfo
    this.templateInfo = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version,
    })
    if(! await templateNpm.exists()){
      const spinner = spinnerStart('正在下载模板...')
      sleep()
      try{
        await templateNpm.install()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if(await templateNpm.exists()){
          log.success('下载模板成功')
          this.templateNpm = templateNpm
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...')
      sleep()
      try{
        await templateNpm.update()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if(await templateNpm.exists()){
          log.success('更新模板成功')
          this.templateNpm = templateNpm
        }
      }
    }
  }
  
  async prepare(){
    // 0. 判断项目模板是否存在
    const template = await getProjectTemplate()
    if(!template || template.length === 0){
      throw new Error('项目模板不存在！')
    }
    this.template = template
    const localPath = process.cwd()
    // 1. 判断当前目录是否为空
    const ret = this.isDirEmpty(localPath)
    if(!ret){
      let ifContinue = false
      if(!this.force){
        // 1.1 询问是否继续创建
        ifContinue  = (await (inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？'
        }))).ifContinue
        if(!ifContinue){
          return 
        }
      }
      // 2. 是否启动强制更新
     if(ifContinue || this.force){
       // 清空当前目录 慎重操作
       // 二次确认
       const { confirmDelete } = await  inquirer.prompt({
         type: 'confirm',
         name: 'confirmDelete',
         default: false,
         message: '是否确认清空当前目录下的文件？'
       })
       if(confirmDelete){
         fse.emptyDirSync(localPath)
       }
     }
    }
    return this.getProjectInfo()
  }

  async getProjectInfo(){
    function isValidName(v){
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
    }
    let projectInfo = {}
    let isProjectNameValid = false
    if(isValidName(this.projectName)){
      isProjectNameValid = true
      projectInfo.projectName = this.projectName
    }
    
    // 1. 选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT
        },
        {
          name: '组件',
          value: TYPE_COMPOENT
        }
      ],
    })
    log.verbose('type', type)
    this.template = this.template.filter(template => {
      return (template.tag.includes(type))
    })
    const title = type === TYPE_PROJECT ? '项目' : '组件'
    // 2. 获取项目的基本信息
    const projectPrompt = []
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function(v) {
        // 1.首字符必须为英文字符
        // 2. 尾字符必须为英文或数字，不能为字符
        // 3.字符仅允许“- _”
        const done = this.async()
        setTimeout(function(){
          if(!isValidName(v)){
            done(`请输入合法的${title}名称！`)
            return false;
          } else {
            done(null, true)
          }
        },0)
      },
    }
    const customPrompt = {
      type: 'input',
      name: 'description',
      message: `请输入自定义项目描述信息`,
      default: '',
      validate: function(v) {
        const done = this.async()
        setTimeout(function(){
          if(!v){
            done(`请输入自定义项目描述信息！`)
            return false;
          } else {
            done(null, true)
          }
        },0)
      },
    }
    if(!isProjectNameValid){
      projectPrompt.push(projectNamePrompt)
    }

    projectPrompt.push(
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
        default: '1.0.0',
        validate: function(v) {
          // 1.校验版本号
          const done = this.async()
          setTimeout(function(){
            if(!(!!semver.valid(v))){
              done(`请输入合法的版本号！`)
              return 
            }
            done(null, true)
          },0)
        },
        filter: function(v){
          if(semver.valid(v)) {
            return semver.valid(v)
          } else {
            return v
          }
        }
      },

      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模板`,
        choices: this.createTemplateChoice(),
      }
    )
    // if(this.template && this.template.length > 0) {
    //   this.template.forEach(item => {
    //     if(item.type === 'custom'){
    //       projectPrompt.push(customPrompt)
    //     }
    //   })
    // }
    if(type === TYPE_PROJECT) {
      const project = await inquirer.prompt(projectPrompt)
      projectInfo = { ...projectInfo, type, ...project }
      
    } else if (type === TYPE_COMPOENT){
      const descriptionPrompt = {
        type: 'input',
        name: 'componentDescription',
        message: `请输入组件描述信息`,
        default: '',
        validate: function(v) {
          // 1.校验版本号
          const done = this.async()
          setTimeout(function(){
            if(!v){
              done(`请输入组件描述信息！`)
              return 
            }
            done(null, true)
          },0)
        },
      }
      projectPrompt.push(descriptionPrompt)
      const component = await inquirer.prompt(projectPrompt)
      projectInfo = { ...projectInfo, type, ...component }
    }
    // 生成className
    if(projectInfo.projectName){
      projectInfo.name = projectInfo.projectName
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '')
    }
    
    if(projectInfo.projectVersion){
      projectInfo.version = projectInfo.projectVersion
    }
    if(projectInfo.componentDescription){
      projectInfo.description = projectInfo.componentDescription
    }
    // if(projectInfo.description){
    //   projectInfo.description = projectInfo.description
    // }
    return projectInfo
  }

  isDirEmpty(localPath){
    let fileList = fs.readdirSync(localPath)
    // 文件过滤逻辑
    fileList = fileList.filter(file => (
      !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
    ))
    return !fileList || fileList.length <= 0
  }

  createTemplateChoice(){
    return this.template.map(item => ({
      value: item.npmName,
      name: item.name
    }))
  }
}

function init(argv) {
  return new InitCommand(argv)
}

module.exports = init;
module.exports.InitCommand = InitCommand;