using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;
using VidyanoWeb3.Service.Model;
using System.Linq;
using VidyanoWeb3.Service.Indexes;

namespace VidyanoWeb3.Service
{
    public partial class VidyanoWeb3Context : TargetRavenDBContext
    {
        public VidyanoWeb3Context(IDocumentSession session)
            : base(session)
        {
        }

        public IRavenQueryable<Company> Companies => base.Query<Company>();

        public IRavenQueryable<Employee> Employees => base.Query<Employee>();

        public IRavenQueryable<Order> Orders => base.Query<Order>();

        public IQueryable<VOrder> VOrders => Query<VOrder, Orders_Overview>().AsNoTracking();
        
        public IRavenQueryable<Shipper> Shippers => base.Query<Shipper>();
    }
}