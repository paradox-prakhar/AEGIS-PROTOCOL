import {createPublicClient} from '@arkiv-network/sdk';import{rabdi}from'@arkiv-network/sdk/chains';import{http}from'viem';
const c=createPublicClient({chain:rabdi({accessKey:''}),transport:http(undefined,{timeout:15000,retryCount:0})});
console.log(JSON.stringify({chainId:await c.getChainId(),balance:(await c.getBalance({address:'0x2Df43B66A31cd93792E4a32Af494b5a18c614148'})).toString()}));
