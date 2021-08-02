// node 来解析packages目录

const fs = require("fs")
const execa = require("execa")

// 读取目录中要打包的文件夹
const dirs = fs.readdirSync("packages").filter(p => {
    return fs.statSync(`packages/${p}`).isDirectory()
})
console.log(`dirs`, dirs)

// 并行打包所有的文件夹

async function build(target) { // -env NODE_ENV=XXX
    await execa('rollup', ['-c', '--environment', `TARGET:${target}`], {stdio: 'inherit'} /* 子进程的输出在父进程中输出 */)
    
}

function runParallel(dirs, iterFn) {
    let result = []
    for (let item of dirs) {
        result.push(iterFn(item))
    }
    return Promise.all(result)
}

runParallel(dirs, build).then(() => {
    console.log('成功');
})