with open('.github/workflows/build-ipa.yml', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('ios/build/Build/Products/Release-iphoneos/SoulShuffle.ipa', 'ios/build/Build/Products/*-iphoneos/SoulShuffle.ipa')

with open('.github/workflows/build-ipa.yml', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
