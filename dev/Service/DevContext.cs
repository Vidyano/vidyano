using Raven.Client.Documents.Linq;
using Raven.Client.Documents.Session;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;
using Dev.Service.Model;
using System.Linq;
using Dev.Service.Indexes;

namespace Dev.Service
{
    public partial class DevContext : TargetRavenDBContext
    {
        public DevContext(IDocumentSession session)
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