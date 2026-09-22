
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://obqarkmuvppaebltfynz.supabase.co', 'sb_publishable_e6HAWVH3G1wE9OCZw7SaWg_Rt6zIvEo');

async function fixSizes() {
    const { data: sizes } = await supabase.from('Tipos_Talla').select('*');
    console.log('Current sizes:', sizes);
}
fixSizes();

