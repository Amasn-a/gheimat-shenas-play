from pathlib import Path
import shutil, sys
root=Path(__file__).resolve().parents[1]
out=root/'dist'
if out.exists(): shutil.rmtree(out)
out.mkdir(exist_ok=True)
for name in ('assets','fonts','play','src','styles'):
 shutil.copytree(root/name,out/name,dirs_exist_ok=True)
shutil.copy2(root/'index.html',out/'index.html')
print('Static Play build ready:',out)

if '--qa' in sys.argv:
 for src,dst in [('qa-layout.html','__layout.html'),('qa-viewport.html','__qa.html'),('qa-layout-viewport.html','__qa-layout.html'),('qa-share.html','__share.html')]:
  if (root/'scripts'/src).exists(): shutil.copy2(root/'scripts'/src,out/dst)   # QA pages are kept out of the published repo
