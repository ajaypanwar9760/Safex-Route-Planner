
#include<vector>
#include<unordered_map>

struct Edge{
int to;
double distance;
double risk;
};

extern std::unordered_map<int,std::vector<Edge>> graph;
