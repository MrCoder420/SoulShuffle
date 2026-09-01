const fs = require('fs');

let text = fs.readFileSync('app/(tabs)/history.tsx', 'utf8');

const regex = /\/\/ Case 5: Rejected \/ Declined\s+if \(rawStatus === 'REJECTED' \|\| rawStatus === 'DECLINED'\) \{\s+return \{\s+headline: isSender\s+\? 'Card is sent • Declined by partner \(Not completed\)'\s+: 'Card received • You declined this dare',\s+subtext: isSender\s+\? \\$\{partnerName\} chose not to accept this dare\.\\s+: \You chose to decline this dare from \$\{partnerName\}\.\,/gm;

if (regex.test(text)) {
  text = text.replace(regex, // Case 5: Rejected / Declined
    if (rawStatus === 'REJECTED' || rawStatus === 'DECLINED') {
      const penaltyLog = (challenge as any).penalty_log && (challenge as any).penalty_log.length > 0 ? (challenge as any).penalty_log[0] : null;
      const transferredCardName = penaltyLog?.user_card_deck?.cards?.name;
      
      let newSubtext = isSender
        ? \\ chose not to accept this dare.\
        : \You chose to decline this dare from \.\;
        
      if (transferredCardName) {
         newSubtext = isSender 
           ? \\ declined this dare. You received "\" as compensation!\
           : \You declined this dare. Your "\" was given to \ as a penalty.\;
      }

      return {
        headline: isSender
          ? 'Card is sent • Declined by partner (Penalty Applied)'
          : 'Card received • You declined this dare (Penalty Applied)',
        subtext: newSubtext,);
  fs.writeFileSync('app/(tabs)/history.tsx', text, 'utf8');
  console.log('Successfully updated Case 5 in history.tsx!');
} else {
  console.log('Could not find the target string!');
}
