import os

with open('components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_block = '''                try {
                  await GoogleSignin.signOut();
                  console.log('[LOGOUT] Google session cleared.');
                } catch (e) {}
                
                try {
                  await GoogleSignin.revokeAccess();
                  console.log('[LOGOUT] Google access revoked to force account picker next time.');
                } catch (e) {}'''

new_block = '''                try {
                  // If the app was restarted, the native SDK might not know we are signed in,
                  // so we should try to restore the session silently before signing out,
                  // otherwise signOut() might throw an error and fail to clear Play Services.
                  try {
                    await GoogleSignin.signInSilently();
                  } catch (e) {}
                  
                  await GoogleSignin.signOut();
                  console.log('[LOGOUT] Google session cleared.');
                } catch (e) {
                  console.log('[LOGOUT] signOut error: ', e);
                }
                
                try {
                  await GoogleSignin.revokeAccess();
                  console.log('[LOGOUT] Google access revoked to force account picker next time.');
                } catch (e) {
                  console.log('[LOGOUT] revokeAccess error: ', e);
                }'''

if old_block in code:
    code = code.replace(old_block, new_block)
    with open('components/Sidebar.tsx', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed Sidebar.tsx successfully!")
else:
    print("Could not find the block to replace!")
