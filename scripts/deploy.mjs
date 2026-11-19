// ينشر الموقع على GitHub Pages (فرع gh-pages)
// الاستخدام: npm run deploy
// إعدادات Supabase تنقرأ من ملف .env.production.local (ما ينرفع لـ GitHub)
import { execSync } from 'node:child_process';
import { copyFileSync, writeFileSync, rmSync } from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const repo = execSync('git remote get-url origin').toString().trim();
const name = repo.replace(/\.git$/, '').split('/').pop();

run('npm test');
run('npx vite build', { env: { ...process.env, BASE_PATH: `/${name}/` } });
copyFileSync('dist/index.html', 'dist/404.html'); // عشان روابط مثل /menu تفتح مباشرة
writeFileSync('dist/.nojekyll', '');

rmSync('dist/.git', { recursive: true, force: true });
const g = (c) => run(`git ${c}`, { cwd: 'dist' });
g('init -q -b gh-pages');
g('add -A');
g(`-c user.name="deploy" -c user.email="deploy@users.noreply.github.com" commit -q -m "نشر ${new Date().toISOString()}"`);
g(`push -f -q ${repo} gh-pages`);
rmSync('dist/.git', { recursive: true, force: true });
console.log(`\nتم النشر ✓  https://${repo.split('/').at(-2).replace(/^.*:/, '')}.github.io/${name}/`);
