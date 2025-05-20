using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Vidyano.Core.Extensions;
using Vidyano.Service;
using Vidyano.Service.Repository;
using Vidyano.Service.RavenDB;

namespace VidyanoWeb3.Service
{
    public class DefaultPersistentObjectActions<TContext, TEntity> : PersistentObjectActionsReference<TContext, TEntity>
        where TContext : TargetRavenDBContext
        where TEntity : class
    {
        public DefaultPersistentObjectActions(TContext context) : base(context)
        {
        }
    }
}