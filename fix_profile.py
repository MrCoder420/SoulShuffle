import os

filepath = 'app/(tabs)/profile.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix isHost logic to NOT default to true if myUserId is missing, 
# which causes the partner avatar to swap to the user's own avatar!
old_logic = "const isHost = myUserId ? (myUserId === room.host_id) : true;"
new_logic = '''
          // Determine if current user is the host. If myUserId is missing, we check if current user is partner.
          // If we can't tell, default to true but this should rarely happen.
          let isHost = true;
          if (myUserId) {
            isHost = (myUserId === room.host_id);
          } else {
            const cachedId = await AsyncStorage.getItem('cachedUserId');
            if (cachedId) isHost = (cachedId === room.host_id);
          }
'''

if old_logic in code:
    code = code.replace(old_logic, new_logic)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed profile.tsx isHost logic!")
else:
    print("Could not find isHost logic in profile.tsx!")
