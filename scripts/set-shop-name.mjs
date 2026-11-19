// يغيّر اسم المحل في قاعدة البيانات
// الاستخدام: ADMIN_PASS=... node scripts/set-shop-name.mjs "الاسم"
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(readFileSync('.env.production.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_KEY);
const { error: e1 } = await sb.auth.signInWithPassword({ email: process.env.ADMIN_USER || 'admin@example.com', password: process.env.ADMIN_PASS });
if (e1) { console.error('ما قدرنا ندخل:', e1.message); process.exit(1); }
const { error } = await sb.from('settings').update({ shop_name: process.argv[2], updated_at: new Date().toISOString() }).eq('id', 1);
if (error) throw error;
const { data } = await sb.from('settings').select('shop_name').eq('id', 1).single();
console.log('اسم المحل الحين:', data.shop_name);
await sb.auth.signOut();
process.exit(0);
