'use strict';

const pkgDir = require("pkg-dir").sync
const path = require("path")
const fse = require("fs-extra")
const pathExists = require("path-exists").sync
const npminstall = require("npminstall")

const { isObject } = require("@imooc-cli-devp/utils")
const formatPath = require("@imooc-cli-devp/format-path")
const { getDefaultRegistry, getNpmLatestVersion }  = require("@imooc-cli-devp/get-npm-info")

class Package {
  constructor(options){
    if(!options){
      throw new Error('Packsge类的options参数不能为空！')
    }
    if(!isObject(options)){
      throw new Error('Packsge类的options参数必须为对象！')
    }
    // package的目标路径
    this.targetPath = options.targetPath

    // packsge的缓存路径
    this.storeDir = options.storeDir

    // package的name
    this.packageName = options.packageName
    
    // package的version
    this.packageVersion = options.packageVersion

    // package缓存目录前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '_')
  }

  async prepare(){
    if(this.storeDir && !pathExists(this.storeDir)){
      fse.mkdirpSync(this.storeDir)
    }
    if(this.packageVersion === 'latest'){
      this.packageVersion = await getNpmLatestVersion(this.packageName)
    }
  }

  get cacheFilePath(){
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
  }

  getSpecificCacheFilePath(packageVersion){
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
  }

  // 判断当前 package是否存在
  async exists(){
    if(this.storeDir) {
      await this.prepare()
      return pathExists(this.cacheFilePath)
    } else {
      return pathExists(this.targetPath)
    }
  }
  // 安装package
  async install(){
    await this.prepare()
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [{
        name: this.packageName,
        version: this.packageVersion
      }],
    })
  }
  // 更新package
  async update(){
    await this.prepare()
    // 1. 获取最新的npm模块版本号
    const latestPackageVersion = await getNpmLatestVersion(this.packageName)
    // 2. 查询最新版本号路径是否存在
    const latestFilePath = this.getSpecificCacheFilePath(latestPackageVersion)
    //3. 若不存在，直接安装
    if(!pathExists(latestFilePath)){
      return npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [{
          name: this.packageName,
          version: latestPackageVersion
        }],
      })
      this.packageVersion = latestPackageVersion
    }
  }
  // 获取入口文件路径
  getRootFilePath(){
    function _getRootFile(targetPath){
      // 1. 获取package.json所在路径
      const dir = pkgDir(targetPath)
      if(dir){
        // 2.读取package.json
        const pkgFile = require(path.resolve(dir, 'package.json'))
        // 3. 找到 main/lib并输出为路径
        if(pkgFile && pkgFile.main) {
          return formatPath(path.resolve(dir, pkgFile.main))
        }
        // 4. 路径兼容
      }
      return null
    }
    if(this.storeDir){
      return _getRootFile(this.cacheFilePath)
    } else {
      return _getRootFile(this.targetPath)
    }
  
  }
}

module.exports = Package;
