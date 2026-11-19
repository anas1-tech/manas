// يرفع القائمة الأولية لـ Supabase
// الاستخدام: ADMIN_PASS=كلمة_المرور node scripts/import-menu.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { toProducts, MENU_NOTE, ROWS } from '../data/menu-initial.mjs';

const env = Object.fromEntries(readFileSync('.env.production.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);
const user = process.env.ADMIN_USER || 'admin@example.com';
const { error: authErr } = await sb.auth.signInWithPassword({ email: user, password: process.env.ADMIN_PASS });
if (authErr) { console.error('ما قدرنا ندخل:', authErr.message); process.exit(1); }

const { data: existing, error: e1 } = await sb.from('products').select('*');
if (e1) throw e1;
const rows = toProducts(existing);
const { error: e2 } = await sb.from('products').upsert(rows);
if (e2) throw e2;
const { data: s } = await sb.from('settings').select('menu_note').eq('id', 1).single();
if (!s?.menu_note) await sb.from('settings').update({ menu_note: MENU_NOTE }).eq('id', 1);
const { count } = await sb.from('products').select('*', { count: 'exact', head: true });
console.log(`تم ✓ ${ROWS.length} سطر من القائمة، والمنتجات في قاعدة البيانات الحين: ${count}`);
await sb.auth.signOut();
