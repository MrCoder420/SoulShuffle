import os

src_dir = '/Users/priyanshu/.gemini/antigravity-ide/brain/12941211-c316-4db9-9b20-623658136abf/'
dst_dir = './assets/images/'

files = {
    'avatar_romantic_cupid_bear_1785826572576.png': 'avatar_cupid_bear.png',
    'avatar_funny_love_cat_1785826586750.png': 'avatar_love_cat.png',
    'avatar_romantic_couple_bunnies_1785826604194.png': 'avatar_couple_bunnies.png',
    'avatar_flirty_red_fox_1785826620115.png': 'avatar_flirty_fox.png',
    'avatar_funny_shiba_heart_1785826633253.png': 'avatar_shiba_heart.png',
    'avatar_romantic_penguins_cuddle_1785826650961.png': 'avatar_penguins_cuddle.png'
}

for src, dst in files.items():
    src_path = os.path.join(src_dir, src)
    dst_path = os.path.join(dst_dir, dst)
    try:
        with open(src_path, 'rb') as f_in:
            data = f_in.read()
        with open(dst_path, 'wb') as f_out:
            f_out.write(data)
        print(f"SUCCESS: {dst} ({len(data)} bytes)")
    except Exception as e:
        print(f"ERROR: {e}")
