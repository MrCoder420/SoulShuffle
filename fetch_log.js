const https = require('https');
const fs = require('fs');

const url = 'https://storage.googleapis.com/eas-workflows-production/logs/a8229d2a-b2bf-4176-a245-2016dc5e11f1/a125e6a4-3941-4ef1-9300-4faaf7e503ae/2026-09-01T16%3A42%3A24Z-ea4bdc17-300f-4b23-9260-41866e4fb5c2.txt?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=www-production%40exponentjs.iam.gserviceaccount.com%2F20260901%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260901T164950Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=62172b967481baedf13f283a1428ee2172d1207f36ba183a329bac9591a49128d34f965e212c05e87adbaf5eb0dabb5a3d18917f68bdf381f9f3b1cab7afb258c62997e0b545c8578447eedffc1e5342eec098265901307dc31b04959aa244fe2526a3c34520a6c80f8d698ac988ff4dfe89550e499315bc099acb0810c1aae9426874e3aa6a41cb6ef45028bdaf613521bb79202cca96bd65d84bf520089ded9a9baf8aa7d3be6e83ee6250f6b9a3382f848d24a6315dd9f4e05b9933b225127c778273ca1f06eaae6782b0aba0ebc613e405370c30fcea31af182fd4dd4ca79c5722c3c2aa9acd03a0ddd0f55672d6be08baa50f7d7530e98dfa49ab6a4280';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('build-log.txt', data);
    console.log('Downloaded log');
  });
});
