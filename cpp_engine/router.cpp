
#include "graph.h"
#include "router.h"
#include<queue>
using namespace std;

unordered_map<int,vector<Edge>> graph;

vector<int> safestPath(int src,int dest){
priority_queue<
pair<double,int>,
vector<pair<double,int>>,
greater<pair<double,int>>
> pq;

unordered_map<int,double> dist;

pq.push({0,src});
dist[src]=0;

while(!pq.empty()){
auto cur=pq.top();
pq.pop();
int u=cur.second;

for(auto &e:graph[u]){
double cost=cur.first+e.distance+2*e.risk;
if(!dist.count(e.to)||cost<dist[e.to]){
dist[e.to]=cost;
pq.push({cost,e.to});
}
}
}
return {};
}
