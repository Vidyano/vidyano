using System;
using System.Linq.Expressions;
using Vidyano.Service.Repository;
using VidyanoWeb3.Service.Model;

namespace VidyanoWeb3.Service
{
    public sealed class EmployeeActions : PersistentObjectActionsReference<VidyanoWeb3Context, Employee>
    {
        public EmployeeActions(VidyanoWeb3Context context)
            : base(context)
        {
        }
    }
}