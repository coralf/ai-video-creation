import { IChatTTSParams } from "../ui/modules/setting/audio-setting";

export const DEFAULT_RANDOM_SEED = 50;


export const DEFAULT_AUDIO_SETTNG: IChatTTSParams = {
    stream: false,
    lang: null,
    skip_refine_text: true,
    refine_text_only: false,
    use_decoder: true,
    audio_seed: 1111,
    text_seed: 1,
    do_text_normalization: false,
    do_homophone_replacement: false,
    params_refine_text: {
        prompt: '',
        top_P: 0.7,
        top_K: 20,
        temperature: 0.3,
        repetition_penalty: 1,
        max_new_token: 384,
        min_new_token: 0,
        show_tqdm: true,
        ensure_non_empty: true,
        stream_batch: 24,   
    },
    params_infer_code: {
        prompt: '[speed_5]',
        top_P: 0.1,
        top_K: 20,
        temperature: 0.3,
        repetition_penalty: 1.05,
        max_new_token: 2048,
        min_new_token: 0,
        show_tqdm: true,
        ensure_non_empty: true,
        stream_batch: true,
        spk_emb: null,
        manual_seed: 1
    }
}