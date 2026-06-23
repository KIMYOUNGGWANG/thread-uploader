const fs = require('fs');
const content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const panelsStartIdx = content.indexOf('            {/* Account Intelligence Panel */}');
const postsGridIdx = content.indexOf('            {/* Posts Grid */}');

if (panelsStartIdx === -1 || postsGridIdx === -1) {
  console.log('Could not find markers');
  process.exit(1);
}

const panelsCode = content.substring(panelsStartIdx, postsGridIdx);

const newContent = content.replace(panelsCode, '');

// Now we need to insert panelsCode BEFORE the `isFetching && posts.length === 0 ?` line.
// Wait, the PortfolioOverview is:
//       <main className="max-w-6xl mx-auto px-4 py-8">
//         {campaignSummary && (
//           <PortfolioOverview summary={campaignSummary} />
//         )}
//         {isFetching && posts.length === 0 ? (

const insertTarget = '        {isFetching && posts.length === 0 ? (';
const insertIdx = newContent.indexOf(insertTarget);

if (insertIdx === -1) {
  console.log('Could not find insert target');
  process.exit(1);
}

const finalContent = newContent.substring(0, insertIdx) + 
  '        <div className="space-y-6 mb-6">\n' + 
  panelsCode.split('\n').map(l => l.substring(4)).join('\n') + 
  '        </div>\n' + 
  newContent.substring(insertIdx);

fs.writeFileSync('src/components/Dashboard.tsx', finalContent);
console.log('Panels moved successfully');
