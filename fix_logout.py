import os

with open('components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = '''                const isSignedIn = await GoogleSignin.isSignedIn();
                if (isSignedIn) {
                  await GoogleSignin.signOut();
                  console.log('[LOGOUT] Google session cleared.');
                }'''

new_block = '''                try {
                  await GoogleSignin.signOut();
                  console.log('[LOGOUT] Google session cleared.');
                } catch (e) {}
                
                try {
                  await GoogleSignin.revokeAccess();
                  console.log('[LOGOUT] Google access revoked to force account picker next time.');
                } catch (e) {}'''

if old_block in code:
    code = code.replace(old_block, new_block)
    with open('components/Sidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed Sidebar.tsx successfully!")
else:
    print("Could not find the block to replace!")
