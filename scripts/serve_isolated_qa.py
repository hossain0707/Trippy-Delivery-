"""One isolated QA process: FastAPI, controlled data and the static web build. Never deployed."""
import os,sys
from pathlib import Path
os.environ['APP_ENV']='test'
os.environ['LIVE_ORDERS_ENABLED']='true'
os.environ['PILOT_APPROVED']='true'
import tempfile
os.environ['DATABASE_URL']='sqlite+pysqlite:///'+str(Path(tempfile.mkdtemp(prefix='trippy-isolated-qa-'))/'qa.db')
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'services/api'))
from fastapi import Header,HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from app.main import app
from app.core.database import Base,engine,session_factory
from app.core.auth import Actor,get_actor
from app.modules.groceries.models import Product
from app.modules.commerce.models import ServiceSetting
from app.modules.commerce.schemas import PaymentSettings,PilotSettings
import importlib.util
spec=importlib.util.spec_from_file_location('catalog_import',root/'services/api/scripts/import_catalog.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
Base.metadata.create_all(engine())
with session_factory()() as db:
    module.import_catalog(db)
    p=db.get(Product,'FISH-ROHU');p.price_approved=True;p.price_bdt=350;p.stock_qty=100
    opts=p.details['preparation_options'];p.details={**p.details,'preparation_options':[{**o,'enabled':True,'fee_bdt':'30' if o['id']!='whole' else '0'} for o in opts]}
    for key,value in [('pilot',PilotSettings(zones=[dict(city='Dhaka',area='Dhanmondi',fee_bdt='60',active=True,capacity_per_slot=50,preparation_ready=True,courier_ready=True)]).model_dump(mode='json')),('payments',PaymentSettings(cod_enabled=True,bkash=dict(enabled=True,verified=True,receiving_number='01712345678',instructions='ISOLATED QA ONLY. This is not a real receiving number. Do not transfer money.')).model_dump(mode='json'))]:
        obj=db.get(ServiceSetting,key)
        if obj is None:obj=ServiceSetting(key=key);db.add(obj)
        obj.value=value
    db.commit()
def actor(authorization:str|None=Header(default=None)):
    if authorization=='Bearer qa-owner':return Actor('qa-owner',frozenset({'customer','admin'}),'owner@qa.invalid','Isolated Owner')
    if authorization=='Bearer qa-customer':return Actor('qa-customer',frozenset({'customer'}),'customer@qa.invalid','Isolated Customer')
    raise HTTPException(401,'Only isolated QA identities are supported')
app.dependency_overrides[get_actor]=actor
@app.get('/qa-status')
def qa_status():return {'isolated':True,'payments_are_simulated':True}
from starlette.staticfiles import StaticFiles
from starlette.responses import FileResponse
class Web(StaticFiles):
    async def get_response(self,path,scope):
        target=root/'apps/web/out'/path
        if not target.suffix and (target.with_suffix('.html')).exists():return FileResponse(target.with_suffix('.html'))
        return await super().get_response(path,scope)
app.mount('/',Web(directory=root/'apps/web/out',html=True),name='web')
if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='0.0.0.0',port=int(sys.argv[sys.argv.index('--port')+1]) if '--port' in sys.argv else int(os.environ.get('PORT','3000')))
