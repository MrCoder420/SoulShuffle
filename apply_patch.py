import os

filepath = 'app/(tabs)/history.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

target = '''    // Case 5: Rejected / Declined
    if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      return {
        headline: isSender
          ? 'Card is sent • Declined by partner (Not completed)'
          : 'Card received • You declined this dare',
        subtext: isSender
          ? ${partnerName} chose not to accept this dare.
          : You chose to decline this dare from .,
        statusText: 'Declined',
        actionLabel: isSender ? 'Passed' : 'Declined by You','''

replacement = '''    // Case 5: Rejected / Declined
    if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      const penaltyLog = (challenge as any).penalty_log && (challenge as any).penalty_log.length > 0 ? (challenge as any).penalty_log[0] : null;
      const transferredCardName = penaltyLog?.user_card_deck?.cards?.name;
      
      let newSubtext = isSender
        ? ${partnerName} chose not to accept this dare.
        : You chose to decline this dare from .;
        
      if (transferredCardName) {
         newSubtext = isSender 
           ? ${partnerName} declined this dare. You received "" as compensation!
           : You declined this dare. Your "" was transferred to  as a penalty.;
      }

      return {
        headline: isSender
          ? 'Card is sent • Declined by partner (Penalty Applied)'
          : 'Card received • You declined this dare (Penalty Applied)',
        subtext: newSubtext,
        statusText: 'Declined',
        actionLabel: isSender ? 'Passed' : 'Declined by You','''

if target in text:
    text = text.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced successfully!")
else:
    print("Target not found!")
