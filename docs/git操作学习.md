### git操作学习

```markdown
后面日常开发，可以按下面固定流程来 push：

一步：先把远程改成你现在的仓库（只需要做一次）

  在项目目录里执行一次（之后就不用再改了）：

  git remote set-url origin https://github.com/slingjie/pv-site-survey.git

  然后确认一下：

  git remote -v

  看到 origin 的地址已经是 pv-site-survey.git 就可以了。

  ———

  以后每次修改后的日常流程

  每次你改完代码，想同步到 GitHub 时：

  # 1. 看看有哪些改动
  git status

  # 2. 把要提交的文件加进暂存区（全部改动）
  git add .

  # 3. 写一个提交说明（自己换成合适的中文或英文）
  git commit -m "feat: xxx"

  # 4. 推送到 GitHub 的 main 分支
  git push origin main

  如果你当前分支不是 main，就用 git branch 看一下分支名，然后把上面的 main 换成对
  应分支名即可。
```



  ### 清理 npm 缓存（可选）

  清理完 `node_modules` 如果还不放心，可以在 PowerShell 里执行：

  ```powershell
  npm cache clean --force
  ```

  这个会清理本机 npm 缓存，也能腾出一些空间。

