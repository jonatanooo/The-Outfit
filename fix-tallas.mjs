
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://obqarkmuvppaebltfynz.supabase.co", "sb_publishable_e6HAWVH3G1wE9OCZw7SaWg_Rt6zIvEo");

async function run() {
    let { data, error } = await supabase.from("Tipos_Talla").insert({ Nombre_TipoTalla: "XXL" }).select();
    console.log(data, error);
}
run();

